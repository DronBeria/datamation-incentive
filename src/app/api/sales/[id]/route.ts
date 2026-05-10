import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendIncentiveUpdate } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action, reason, note, resolution } = body; // 'approve', 'reject', 'flag', 'resolve_flag', 'dispute', 'resolve_dispute'

    // Role checks based on action
    if ((action === "flag" || action === "dispute") && !["salesperson", "manager", "admin"].includes(session.role)) {
        return NextResponse.json({ error: "Forbidden: Only authorized roles can flag" }, { status: 403 });
    } else if (action !== "flag" && action !== "dispute" && !["manager", "admin"].includes(session.role)) {
        return NextResponse.json({ error: "Forbidden: Management access required" }, { status: 403 });
    }

    const log = await db.prepare(`
        SELECT sl.*, u.email, u.full_name as salesperson_name 
        FROM sales_logs sl 
        JOIN users u ON sl.salesperson_id = u.id 
        WHERE sl.id = ?
    `).get(id) as any;
    if (!log) return NextResponse.json({ error: "Log not found" }, { status: 404 });

    // Dispute authorization check
    if (action === "flag" && session.role === "salesperson" && log.salesperson_id !== session.id) {
        return NextResponse.json({ error: "Forbidden: You can only flag your own logs" }, { status: 403 });
    }

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
            .run((log.notes || "") + " [REJECTED BY " + session.role.toUpperCase() + ": " + (reason || "Policy Violation") + "]", id);

        // Notify salesperson
        await db.prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Sale Rejected', ?, 'error')")
            .run(log.salesperson_id, `Your sale for "${log.client_name}" was rejected. Reason: ${reason || 'None provided'}`);

        // Dispatch Industrial Email
        try {
            await sendIncentiveUpdate(log.email, log.salesperson_name, "Deal Review: REJECTED", 0);
        } catch (e) {
            console.error("Email sync failed", e);
        }

    } else if (action === "flag") {
        if (log.status === "paid") {
            return NextResponse.json({ error: "Cannot flag a paid log" }, { status: 400 });
        }
        await db.prepare("UPDATE sales_logs SET dispute_status = 'flagged', dispute_note = ? WHERE id = ?")
            .run(note || "Flagged for review", id);

        // Notify manager
        try {
            const mgr = await db.prepare("SELECT manager_id from users WHERE id = ?").get(log.salesperson_id) as any;
            if (mgr && mgr.manager_id) {
                await db.prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Dispute Raised', ?, 'alert')")
                    .run(mgr.manager_id, `${log.salesperson_name} flagged sale #${log.id} (${log.client_name}) for review: ${note}`);
            }
        } catch (e) { }

        return NextResponse.json({ message: `Log flagged successfully` });

    } else if (action === "resolve_flag") {
        await db.prepare("UPDATE sales_logs SET dispute_status = 'resolved', dispute_note = ? WHERE id = ?")
            .run((log.dispute_note || "") + " | Resolved: " + (note || ""), id);

        await db.prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Dispute Resolved', ?, 'info')")
            .run(log.salesperson_id, `Manager resolved your flag on sale #${log.id} (${log.client_name}).`);

        return NextResponse.json({ message: `Flag resolved successfully` });

    } else if (action === "dispute") {
        if (log.status !== "earned") {
            return NextResponse.json({ error: "Disputes can only be raised on earned sales" }, { status: 400 });
        }
        if (log.dispute_status === "under_review") {
            return NextResponse.json({ error: "A dispute is already under review for this sale" }, { status: 400 });
        }
        if (session.role === "salesperson" && log.salesperson_id !== session.id) {
            return NextResponse.json({ error: "Forbidden: You can only dispute your own sales" }, { status: 403 });
        }

        await db.prepare("UPDATE sales_logs SET dispute_status = 'under_review', dispute_note = ? WHERE id = ?")
            .run(note || "Dispute raised", id);

        // Notify all managers and admins
        const managers = await db.prepare("SELECT id FROM users WHERE role IN ('manager', 'admin')").all() as any[];
        for (const mgr of managers) {
            await db.prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Dispute Filed', ?, 'alert')")
                .run(mgr.id, `A dispute was raised on sale by ${log.salesperson_name}: ${note || "No reason provided"}`);
        }

        await db.prepare(
            "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value) VALUES (?, 'DISPUTE_FILED', 'sales_log', ?, ?, ?)"
        ).run(session.id, id, JSON.stringify({ dispute_status: log.dispute_status }), JSON.stringify({ dispute_status: "under_review" }));

        return NextResponse.json({ message: "Dispute filed successfully" });

    } else if (action === "resolve_dispute") {
        if (log.dispute_status !== "under_review") {
            return NextResponse.json({ error: "No active dispute to resolve" }, { status: 400 });
        }

        const accepted = resolution === "accept";
        const newDisputeStatus = "resolved";
        const resolvedStatus = accepted ? "pending_review" : log.status;

        await db.prepare("UPDATE sales_logs SET dispute_status = ?, status = ?, dispute_note = ? WHERE id = ?")
            .run(newDisputeStatus, resolvedStatus, (log.dispute_note || "") + ` | Resolved (${resolution}): ${note || ""}`, id);

        const notifMessage = accepted
            ? `Your dispute on sale for "${log.client_name}" was accepted. The sale has been moved back to pending review.`
            : `Your dispute on sale for "${log.client_name}" was reviewed and rejected. The original status is maintained.`;

        await db.prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Dispute Resolved', ?, 'info')")
            .run(log.salesperson_id, notifMessage);

        await db.prepare(
            "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value) VALUES (?, 'DISPUTE_RESOLVED', 'sales_log', ?, ?, ?)"
        ).run(session.id, id, JSON.stringify({ dispute_status: "under_review", status: log.status }), JSON.stringify({ dispute_status: newDisputeStatus, status: resolvedStatus }));

        return NextResponse.json({ message: `Dispute resolved (${resolution})` });

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
