import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session || !["admin", "manager"].includes(session.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const {
        name,
        description,
        calculation_type,
        base_rate,
        target_threshold,
        bonus_rate,
        max_payable,
        max_commission,
        min_commission_threshold,
    } = body;

    const supabase = getSupabase();

    try {
        const { error } = await supabase
            .from('incentive_schemes')
            .update({
                name,
                description,
                calculation_type,
                base_rate: parseFloat(base_rate) || 0,
                target_threshold: parseFloat(target_threshold) || 0,
                bonus_rate: parseFloat(bonus_rate) || 0,
                max_payable: max_payable ? parseFloat(max_payable) : null,
                max_commission: max_commission ? parseFloat(max_commission) : null,
                min_commission_threshold: min_commission_threshold ? parseFloat(min_commission_threshold) : null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id);

        if (error) throw error;

        await supabase.from('audit_logs').insert({
            user_id: session.id,
            action: 'UPDATE',
            entity_type: 'incentive_scheme',
            entity_id: id,
            new_value: JSON.stringify(body),
        });

        return NextResponse.json({ message: "Commission scheme successfully updated" });
    } catch (err: any) {
        console.error("[SCHEME_PUT_ERROR]", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    const role = (session?.role || "").toLowerCase().trim();
    if (!session || !["admin", "manager"].includes(role)) {
        return NextResponse.json({ error: "Only administrators and managers can decommission schemes" }, { status: 403 });
    }

    const { id } = await params;
    const supabase = getSupabase();

    try {
        // Integrity Check: Is it currently assigned to any users?
        const { count: assignedCount } = await supabase
            .from('user_scheme_assignments')
            .select('id', { count: 'exact', head: true })
            .eq('scheme_id', id)
            .is('end_date', null);

        if (assignedCount && assignedCount > 0) {
            return NextResponse.json({ error: "Scheme is currently active for one or more users. Please reassign them before deletion." }, { status: 400 });
        }

        // Integrity Check: Has it been used in historical sales?
        const { count: usedCount } = await supabase
            .from('sales_logs')
            .select('id', { count: 'exact', head: true })
            .eq('scheme_id', id)
            .limit(1);

        if (usedCount && usedCount > 0) {
            // Soft delete: mark as inactive
            await supabase.from('incentive_schemes').update({ status: 'inactive' }).eq('id', id);
            return NextResponse.json({ message: "Scheme has historical records and was archived (set to inactive) instead of being purged." });
        }

        // Hard delete
        const { error } = await supabase.from('incentive_schemes').delete().eq('id', id);
        if (error) throw error;

        await supabase.from('audit_logs').insert({
            user_id: session.id,
            action: 'DELETE',
            entity_type: 'incentive_scheme',
            entity_id: id,
        });

        return NextResponse.json({ message: "Commission scheme purged from repository" });
    } catch (err: any) {
        console.error("[SCHEME_DELETE_ERROR]", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
