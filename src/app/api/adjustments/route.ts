import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import { sendIncentiveUpdate } from "@/lib/email";

export const dynamic = "force-dynamic";

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );
}

export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(req.url);
        const userId = url.searchParams.get("userId");
        const supabase = getSupabase();

        let query = supabase
            .from('adjustments')
            .select('*')
            .order('created_at', { ascending: false });

        const role = (session.role || "").toLowerCase();
        if (role === "salesperson") {
            query = query.eq('salesperson_id', session.id);
        } else if (userId) {
            query = query.eq('salesperson_id', userId);
        }

        const { data: rows, error } = await query;
        if (error) throw error;

        // Resolve salesperson names separately to avoid FK join issues
        const spIds = [...new Set((rows || []).map(r => r.salesperson_id).filter(Boolean))];
        let nameMap: Record<string, string> = {};
        if (spIds.length > 0) {
            const { data: users } = await supabase
                .from('users')
                .select('id, full_name')
                .in('id', spIds);
            if (users) {
                users.forEach(u => { nameMap[u.id] = u.full_name; });
            }
        }

        const result = (rows || []).map(r => ({
            ...r,
            full_name: nameMap[r.salesperson_id] || 'Unknown'
        }));

        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        const role = (session?.role || "").toLowerCase();
        if (!session || !["admin", "manager", "accounts"].includes(role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const { user_id, amount, reason, type } = body;

        if (!user_id || amount === undefined || !reason || !type) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const supabase = getSupabase();

        // Generate Adjustment Ref: ADJ_YYYYMMDD_TYPE_SP
        const { data: userObj } = await supabase.from('users').select('full_name').eq('id', user_id).single();
        const spName = userObj?.full_name || "ST";
        const dateTag = new Date().toISOString().split('T')[0].replace(/-/g, "");
        const typeShort = type.substring(0, 3).toUpperCase();
        const spShort = spName.split(' ').map((n: string) => n[0]).join('').toUpperCase();
        const adjRef = `ADJ_${dateTag}_${typeShort}_${spShort}`;

        const { data: adj, error: aErr } = await supabase
            .from('adjustments')
            .insert({
                salesperson_id: user_id,
                amount: parseFloat(amount),
                reason,
                type,
                status: 'pending',
                reference_number: adjRef
            })
            .select('id')
            .single();

        if (aErr) throw aErr;

        await supabase.from('audit_logs').insert({
            user_id: session.id,
            action: 'CREATE',
            entity_type: 'adjustment',
            entity_id: adj.id,
            new_value: JSON.stringify(body)
        });

        // Notification
        try {
            const { data: user } = await supabase.from('users').select('email, full_name').eq('id', user_id).single();
            if (user?.email) {
                const displayAction = type === 'bonus' ? 'A performance bonus has been applied to your account' : 'A manual adjustment has been applied to your account';
                await sendIncentiveUpdate(user.email, user.full_name, displayAction, parseFloat(amount));
            }
        } catch (e) { }

        return NextResponse.json({ id: adj.id, message: "Adjustment recorded" });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
