import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session || !["admin", "manager"].includes(session.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name, description, calculation_type, base_rate, target_threshold, bonus_rate } = body;

    try {
        await db.prepare(`
          UPDATE public.incentive_schemes 
          SET name = ?, description = ?, calculation_type = ?, base_rate = ?, target_threshold = ?, bonus_rate = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(name, description, calculation_type, base_rate, target_threshold, bonus_rate, id);

        await db.prepare(
            "INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_value) VALUES (?, 'UPDATE', 'incentive_scheme', ?, ?)"
        ).run(session.id, id, JSON.stringify(body));

        return NextResponse.json({ message: "Commission scheme successfully updated" });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session || session.role !== "admin") {
        return NextResponse.json({ error: "Only administrators can decommission schemes" }, { status: 403 });
    }

    const { id } = await params;

    try {
        // Integrity Check: Is it currently assigned to any users?
        const assigned = await db.prepare("SELECT COUNT(*) as count FROM public.user_scheme_assignments WHERE scheme_id = ? AND end_date IS NULL").get(id) as any;
        if (assigned?.count > 0) {
            return NextResponse.json({ error: "Scheme is currently active for one or more users. Please reassign them before deletion." }, { status: 400 });
        }

        // Integrity Check: Has it been used in historical sales?
        const used = await db.prepare("SELECT COUNT(*) as count FROM public.sales_logs WHERE scheme_id = ? LIMIT 1").get(id) as any;
        if (used?.count > 0) {
            // Soft delete: just mark as inactive
            await db.prepare("UPDATE public.incentive_schemes SET status = 'inactive' WHERE id = ?").run(id);
            return NextResponse.json({ message: "Scheme has historical records and was archived (set to inactive) instead of being purged." });
        }

        // Hard delete
        await db.prepare("DELETE FROM public.incentive_schemes WHERE id = ?").run(id);

        await db.prepare(
            "INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id) VALUES (?, 'DELETE', 'incentive_scheme', ?)"
        ).run(session.id, id);

        return NextResponse.json({ message: "Commission scheme purged from repository" });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
