import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendIncentiveUpdate } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session || !["manager", "admin"].includes(session.role)) {
        return NextResponse.json({ error: "Forbidden: Management access required" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action } = body; // 'approve' or 'reject'

    const log = await db.prepare(`
        SELECT sl.*, u.email, u.full_name as salesperson_name 
        FROM sales_logs sl 
        JOIN users u ON sl.salesperson_id = u.id 
        WHERE sl.id = ?
    `).get(id) as any;
    if (!log) return NextResponse.json({ error: "Log not found" }, { status: 404 });

    let newStatus = log.status;

    if (action === "approve") {
        if (log.status !== "pending_review") {
            return NextResponse.json({ error: "Only pending logs can be approved" }, { status: 400 });
        }
        newStatus = "earned";
        await db.prepare("UPDATE sales_logs SET status = 'earned' WHERE id = ?").run(id);

        // Notify salesperson
        await db.prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Sale Approved!', ?, 'success')")
            .run(log.salesperson_id, `Your sale for "${log.client_name}" has been approved and moved to earned.`);

        // Dispatch Industrial Email
        try {
            await sendIncentiveUpdate(log.email, log.salesperson_name, "Deal Review: APPROVED", log.calculated_commission);
        } catch (e) {
            console.error("Email sync failed", e);
        }

    } else if (action === "reject") {
        newStatus = "rejected";
        await db.prepare("UPDATE sales_logs SET status = 'rejected', notes = ? WHERE id = ?")
            .run((log.notes || "") + " [REJECTED BY " + session.role.toUpperCase() + ": " + (body.reason || "Policy Violation") + "]", id);

        // Notify salesperson
        await db.prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Sale Rejected', ?, 'error')")
            .run(log.salesperson_id, `Your sale for "${log.client_name}" was rejected. Reason: ${body.reason || 'None provided'}`);

        // Dispatch Industrial Email
        try {
            await sendIncentiveUpdate(log.email, log.salesperson_name, "Deal Review: REJECTED", 0);
        } catch (e) {
            console.error("Email sync failed", e);
        }

    } else {
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    await db.prepare(
        "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value) VALUES (?, 'LOG_REVIEW', 'sales_log', ?, ?, ?)"
    ).run(session.id, id, JSON.stringify({ status: log.status }), JSON.stringify({ status: newStatus }));

    return NextResponse.json({ message: `Log ${action} successful`, status: newStatus });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session || !["manager", "admin"].includes(session.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const log = await db.prepare("SELECT * FROM sales_logs WHERE id = ?").get(id) as any;

    if (!log) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (log.status === 'paid' || log.status === 'accrued') {
        return NextResponse.json({ error: "Cannot delete logged deal that is already in process" }, { status: 400 });
    }

    await db.prepare("DELETE FROM sales_logs WHERE id = ?").run(id);
    return NextResponse.json({ message: "Sale log removed" });
}
