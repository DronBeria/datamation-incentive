import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

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
    const session = await getSession();
    const role = (session?.role || "").toLowerCase().trim();
    if (!session || !["admin", "manager"].includes(role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, calculation_type, base_rate, target_threshold, bonus_rate, description } = body;

    if (!name || !calculation_type) {
        return NextResponse.json({ error: "Name and calculation type are required" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('incentive_schemes')
        .insert({
            name,
            description: description || "",
            calculation_type,
            base_rate: base_rate || 0,
            target_threshold: target_threshold || 0,
            bonus_rate: bonus_rate || 0
        })
        .select('id')
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await supabase.from('audit_logs').insert({
        user_id: session.id,
        action: 'CREATE',
        entity_type: 'incentive_scheme',
        entity_id: data.id,
        new_value: JSON.stringify(body)
    });

    return NextResponse.json({ id: data.id, message: "Scheme created" });
}
