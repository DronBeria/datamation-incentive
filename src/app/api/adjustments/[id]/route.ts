import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session || !["admin", "manager", "accounts"].includes(session.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    if (!status || !['applied', 'cancelled'].includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    try {
        const adjustment = await db.prepare("SELECT * FROM public.adjustments WHERE id = ?").get(id) as any;
        if (!adjustment) return NextResponse.json({ error: "Adjustment not found" }, { status: 404 });

        await db.prepare(`
            UPDATE public.adjustments 
            SET status = ?, applied_at = ? 
            WHERE id = ?
        `).run(status, status === 'applied' ? new Date().toISOString() : null, id);

        await db.prepare(
            "INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_value, new_value) VALUES (?, 'UPDATE_STATUS', 'adjustment', ?, ?, ?)"
        ).run(session.id, id, JSON.stringify({ status: adjustment.status }), JSON.stringify({ status }));

        return NextResponse.json({ message: `Adjustment successfully ${status}` });
    } catch (err: any) {
        console.error("[ADJUSTMENT_PATCH_ERROR]", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    // Only admin and manager can delete — accounts team CANNOT delete adjustments
    if (!session || !["admin", "manager"].includes(session.role)) {
        return NextResponse.json({ error: "Only administrators and managers can delete adjustments" }, { status: 403 });
    }

    const { id } = await params;

    try {
        const adjustment = await db.prepare("SELECT * FROM public.adjustments WHERE id = ?").get(id) as any;
        if (!adjustment) return NextResponse.json({ error: "Adjustment not found" }, { status: 404 });

        // Only allow deletion of pending/cancelled adjustments
        if (adjustment.status === "applied") {
            return NextResponse.json({
                error: "Cannot delete an applied adjustment — it has already been reflected in the ledger. Cancel it instead."
            }, { status: 400 });
        }

        // Soft delete — preserves the fiscal record for audit trail
        await db.prepare("UPDATE public.adjustments SET deleted_at = NOW() WHERE id = ?").run(id);

        await db.prepare(
            "INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_value) VALUES (?, 'DELETE', 'adjustment', ?, ?)"
        ).run(session.id, id, JSON.stringify({ type: adjustment.type, amount: adjustment.amount, user_id: adjustment.user_id, reason: adjustment.reason }));

        return NextResponse.json({ message: "Adjustment deleted" });
    } catch (err: any) {
        console.error("[ADJUSTMENT_DELETE_ERROR]", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

