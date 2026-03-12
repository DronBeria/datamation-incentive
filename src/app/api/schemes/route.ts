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

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (session.role || "").toLowerCase().trim();
    if (!["admin", "manager", "accounts"].includes(role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = getSupabase();
    const { data: schemes, error } = await supabase
        .from('incentive_schemes')
        .select('*')
        .order('name', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(schemes);
}

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const role = (session.role || "").toLowerCase().trim();
        if (!["admin", "manager"].includes(role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const { name, calculation_type, base_rate, target_threshold, bonus_rate, description, max_payable } = body;

        if (!name || !calculation_type) {
            return NextResponse.json({ error: "Name and calculation type are required" }, { status: 400 });
        }

        const supabase = getSupabase();

        // 1. Create the scheme
        const { data, error: insertError } = await supabase
            .from('incentive_schemes')
            .insert({
                name: name.trim(),
                description: description || "",
                calculation_type,
                base_rate: parseFloat(base_rate) || 0,
                target_threshold: parseFloat(target_threshold) || 0,
                bonus_rate: parseFloat(bonus_rate) || 0,
                max_payable: max_payable ? parseFloat(max_payable) : null,
                status: 'active'
            })
            .select('id')
            .single();

        if (insertError) {
            console.error("[SCHEME_CREATE_ERROR]", insertError);
            return NextResponse.json({ error: insertError.message || "Failed to create scheme in database" }, { status: 400 });
        }

        if (!data?.id) {
            return NextResponse.json({ error: "Scheme created but no ID returned" }, { status: 500 });
        }

        // 2. Log the action (Fire and forget or awaited)
        try {
            await supabase.from('audit_logs').insert({
                user_id: session.id,
                action: 'CREATE',
                entity_type: 'incentive_scheme',
                entity_id: data.id,
                new_value: JSON.stringify(body)
            });
        } catch (auditErr) {
            console.error("[AUDIT_LOG_ERROR]", auditErr);
            // Don't fail the whole request if audit logging fails
        }

        return NextResponse.json({
            id: data.id,
            message: "Commission scheme successfully registered in system"
        });

    } catch (err: any) {
        console.error("[SCHEME_POST_CRASH]", err);
        return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
    }
}
