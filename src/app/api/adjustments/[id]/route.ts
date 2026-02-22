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
