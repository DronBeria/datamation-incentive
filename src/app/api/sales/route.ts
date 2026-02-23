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

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const dateFrom = url.searchParams.get("from");
    const dateTo = url.searchParams.get("to");

    const supabase = getSupabase();

    let query = supabase
      .from('sales_logs')
      .select(`
        *,
        salesperson_name:users!salesperson_id(full_name),
        scheme:incentive_schemes!scheme_id(name, calculation_type, base_rate)
      `)
      .order('sale_date', { ascending: false });

    const role = (session.role || "").toLowerCase();
    if (role === "salesperson") {
      query = query.eq('salesperson_id', session.id);
    } else if (role === "manager") {
      // Find team members
      const { data: team } = await supabase.from('users').select('id').eq('manager_id', session.id);
      const teamIds = (team || []).map(u => u.id).concat(session.id);
      query = query.in('salesperson_id', teamIds);
    }

    if (status && status !== 'all') query = query.eq('status', status);
    if (dateFrom) query = query.gte('sale_date', dateFrom);
    if (dateTo) query = query.lte('sale_date', dateTo);

    const { data: logs, error } = await query;
    if (error) throw error;

    const flattened = (logs || []).map(l => ({
      ...l,
      salesperson_name: l.salesperson_name?.full_name || 'Unknown',
      scheme_name: l.scheme?.name || null,
      calculation_type: l.scheme?.calculation_type || null,
      base_rate: l.scheme?.base_rate || 0
    }));

    return NextResponse.json(flattened);
  } catch (error: any) {
    console.error("[SALES_GET_ERROR]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const role = (session?.role || "").toLowerCase();
    if (!session || !["salesperson", "manager", "admin"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { salesperson_id, client_name, deal_value, product, sale_date, quantity, custom_commission, is_custom, scheme_id: bodySchemeId } = body;

    const spId = role === "salesperson" ? session.id : (salesperson_id || session.id);
    if (!client_name || !deal_value || !sale_date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = getSupabase();
    const val = parseFloat(deal_value);
    if (isNaN(val)) return NextResponse.json({ error: "Invalid deal value" }, { status: 400 });

    // Fetch active scheme
    const { data: assignment } = await supabase
      .from('user_scheme_assignments')
      .select('scheme_id, scheme:incentive_schemes(*), user:users(manager_id)')
      .eq('user_id', spId)
      .is('end_date', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let calculatedCommission = 0;
    let schemeId = bodySchemeId ? parseInt(bodySchemeId) : null;
    const qty = parseFloat(quantity) || 1;

    if (is_custom && ["admin", "manager"].includes(role)) {
      calculatedCommission = parseFloat(custom_commission) || 0;
      schemeId = null;
    } else {
      const activeSchemeId = schemeId || assignment?.scheme_id;
      let rules = (assignment as any)?.scheme_id === activeSchemeId ? (assignment as any)?.scheme : null;

      if (activeSchemeId && !rules) {
        const { data } = await supabase.from('incentive_schemes').select('*').eq('id', activeSchemeId).single();
        rules = data as any;
      }

      if (rules) {
        schemeId = (rules as any).id;
        const { calculation_type, base_rate, target_threshold, bonus_rate } = rules as any;
        if (calculation_type === 'percentage') calculatedCommission = val * base_rate;
        else if (calculation_type === 'tier_based') calculatedCommission = val >= target_threshold ? val * bonus_rate : val * base_rate;
        else if (calculation_type === 'fixed_per_qty') calculatedCommission = base_rate * qty;
        else if (calculation_type === 'quantity_threshold') calculatedCommission = qty >= target_threshold ? bonus_rate * qty : base_rate * qty;
      } else {
        calculatedCommission = val * 0.05; // 5% fallback
        schemeId = null;
      }
    }

    if (isNaN(calculatedCommission) || !isFinite(calculatedCommission)) calculatedCommission = 0;
    const managerOverride = ((assignment as any)?.user?.manager_id && calculatedCommission > 0) ? (calculatedCommission * 0.10) : 0;

    const { data: newLog, error: sErr } = await supabase
      .from('sales_logs')
      .insert({
        salesperson_id: spId,
        client_name,
        deal_value: val,
        product: product || "",
        sale_date,
        scheme_id: schemeId,
        calculated_commission: calculatedCommission,
        override_commission: managerOverride,
        status: 'earned',
        notes: body.notes || (is_custom ? "Custom Agreement" : ""),
        quantity: qty
      })
      .select('id')
      .single();

    if (sErr) throw sErr;

    await supabase.from('audit_logs').insert({
      user_id: session.id,
      action: 'CREATE',
      entity_type: 'sales_log',
      entity_id: newLog.id,
      new_value: JSON.stringify({ client_name, commission: calculatedCommission })
    });

    return NextResponse.json({ id: newLog.id, commission: calculatedCommission, message: "Sale logged" });
  } catch (error: any) {
    console.error("[SALES_POST_ERROR]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
