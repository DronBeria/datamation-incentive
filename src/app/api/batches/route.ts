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
    const status = url.searchParams.get("status");
    const dateFrom = url.searchParams.get("from");
    const dateTo = url.searchParams.get("to");

    const supabase = getSupabase();

    let query = supabase
      .from('incentive_batches')
      .select(`
        *,
        created_by_name:users!created_by(full_name),
        approved_by_name:users!approved_by(full_name),
        paid_by_name:users!paid_by(full_name),
        items:batch_items(
          *,
          salesperson_name:users!salesperson_id(full_name),
          client_name:sales_logs!sales_log_id(client_name),
          deal_value:sales_logs!sales_log_id(deal_value)
        )
      `)
      .order('created_at', { ascending: false });

    // Permissions/Filtering
    const role = (session.role || "").toLowerCase();
    if (role === "accounts") {
      query = query.in('status', ['approved', 'paid']);
    } else if (role === "manager") {
      query = query.eq('created_by', session.id);
    } else if (role === "salesperson") {
      // For salespersons, they should only see batches they are part of.
      // Supabase join filtering is tricky, usually better to fetch and filter or use an RPC.
      // For now, let's allow them to see batches if they are in the items.
      // This might require a more complex query or multiple steps.
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', `${dateTo} 23:59:59`);

    const { data: batches, error } = await query;

    if (error) throw error;

    // Post-processing to flatten the names for the frontend
    const result = (batches || []).map(b => ({
      ...b,
      created_by_name: b.created_by_name?.full_name || 'System',
      approved_by_name: b.approved_by_name?.full_name || null,
      paid_by_name: b.paid_by_name?.full_name || null,
      items: (b.items || []).map((item: any) => ({
        ...item,
        salesperson_name: item.salesperson_name?.full_name || 'Unknown',
        client_name: item.client_name?.client_name || item.description || 'N/A',
        deal_value: item.deal_value?.deal_value || 0
      }))
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[BATCHES_GET_ERROR]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const role = (session?.role || "").toLowerCase();
    if (!session || !["admin", "manager"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { batch_name, period_start, period_end, items } = body;

    if (!batch_name || !items?.length) {
      return NextResponse.json({ error: "Batch name and items required" }, { status: 400 });
    }

    const supabase = getSupabase();
    const totalAmount = items.reduce((s: number, i: any) => s + (i.amount || 0), 0);

    // 1. Create the Batch
    const { data: batch, error: bErr } = await supabase
      .from('incentive_batches')
      .insert({
        batch_name,
        created_by: session.id,
        status: 'draft',
        total_amount: totalAmount,
        period_start: period_start || null,
        period_end: period_end || null
      })
      .select('id')
      .single();

    if (bErr) throw bErr;

    // 2. Insert Batch Items
    const itemsToInsert = items.map((i: any) => ({
      batch_id: batch.id,
      salesperson_id: i.salesperson_id,
      sales_log_id: i.sales_log_id,
      amount: i.amount,
      description: i.description || ""
    }));

    const { error: iErr } = await supabase
      .from('batch_items')
      .insert(itemsToInsert);

    if (iErr) throw iErr;

    // 3. Update Sales Logs status to 'accrued'
    const logIds = items.filter((i: any) => i.sales_log_id).map((i: any) => i.sales_log_id);
    if (logIds.length > 0) {
      const { error: lErr } = await supabase
        .from('sales_logs')
        .update({ status: 'accrued', updated_at: new Date().toISOString() })
        .in('id', logIds);

      if (lErr) throw lErr;
    }

    // 4. Audit
    await supabase.from('audit_logs').insert({
      user_id: session.id,
      action: 'CREATE',
      entity_type: 'incentive_batch',
      entity_id: batch.id,
      new_value: JSON.stringify({ batch_name, items_count: items.length, total: totalAmount })
    });

    // 5. Notifications
    try {
      const { data: accountsList } = await supabase
        .from('users')
        .select('email, roles!inner(name)')
        .eq('roles.name', 'accounts')
        .eq('is_active', true);

      if (accountsList) {
        for (const acc of (accountsList as any[])) {
          await sendIncentiveUpdate(acc.email, "Accounts Team", `New Batch Draft: ${batch_name}`, totalAmount);
        }
      }
    } catch (e) {
      console.warn("Notification error:", e);
    }

    return NextResponse.json({ id: batch.id, message: "Batch created successfully" });
  } catch (error: any) {
    console.error("[BATCH_POST_ERROR]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
