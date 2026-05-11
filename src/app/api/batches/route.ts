import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import { sendIncentiveUpdate } from "@/lib/email";
import { rateLimit, RATE_LIMITS, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const batchWriteLimiter = rateLimit(RATE_LIMITS.API_WRITE);

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
    const limitParam = url.searchParams.get("limit");
    const pageParam = url.searchParams.get("page");

    const supabase = getSupabase();
    const withPagination = !!limitParam;
    const limit = withPagination ? Math.min(parseInt(limitParam!, 10) || 50, 200) : undefined;
    const page = Math.max(0, parseInt(pageParam || "0", 10));
    const offset = withPagination ? page * limit! : undefined;

    const selectStr = `
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
    `;

    let query = supabase
      .from('incentive_batches')
      .select(selectStr, withPagination ? { count: 'exact' } : undefined)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    // Role-based filtering
    const role = (session.role || "").toLowerCase();
    if (role === "accounts") {
      query = query.in('status', ['approved', 'paid']);
    } else if (role === "manager") {
      query = query.eq('created_by', session.id);
    } else if (role === "salesperson") {
      const { data: userBatches } = await supabase
        .from('batch_items')
        .select('batch_id')
        .eq('salesperson_id', session.id);
      const batchIds = Array.from(new Set((userBatches || []).map(b => b.batch_id)));
      if (batchIds.length > 0) {
        query = query.in('id', batchIds);
      } else {
        return NextResponse.json([], { headers: { 'X-Total-Count': '0' } });
      }
    }

    if (status && status !== 'all') query = query.eq('status', status);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', `${dateTo} 23:59:59`);
    if (withPagination) query = (query as any).range(offset, offset! + limit! - 1);

    const { data: batches, error, count } = await query as any;
    if (error) throw error;

    const result = (batches || []).map((b: any) => ({
      ...b,
      created_by_name: b.created_by_name?.full_name || 'System',
      approved_by_name: b.approved_by_name?.full_name || null,
      paid_by_name: b.paid_by_name?.full_name || null,
      items: (b.items || []).map((item: any) => ({
        ...item,
        salesperson_name: item.salesperson_name?.full_name || 'Unknown',
        client_name: item.client_name?.client_name || item.description || 'N/A',
        deal_value: item.deal_value?.deal_value || 0,
      })),
    }));

    const headers: Record<string, string> = {};
    if (withPagination && count !== null) headers['X-Total-Count'] = String(count);

    return NextResponse.json(result, { headers });
  } catch (error: any) {
    console.error("[BATCHES_GET_ERROR]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const rl = batchWriteLimiter.check(getClientIp(req));
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests — please wait before creating another batch." },
      { status: 429, headers: batchWriteLimiter.headers(rl) }
    );
  }

  try {
    const session = await getSession();
    const role = (session?.role || "").toLowerCase();
    if (!session || !["admin", "manager"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Idempotency key — prevents double-creation on network retry
    const idempotencyKey = req.headers.get("X-Idempotency-Key") || null;

    const body = await req.json();
    const { batch_name, period_start, period_end, items } = body;

    if (!batch_name || !items?.length) {
      return NextResponse.json({ error: "Batch name and items required" }, { status: 400 });
    }

    const supabase = getSupabase();
    const totalAmount = items.reduce((s: number, i: any) => s + (i.amount || 0), 0);
    const logIds: number[] = items.filter((i: any) => i.sales_log_id).map((i: any) => i.sales_log_id);
    const adjIds: number[] = items.filter((i: any) => i.adjustment_id).map((i: any) => i.adjustment_id);

    const dateTag = new Date().toISOString().split('T')[0].replace(/-/g, "");
    const randomTag = Math.random().toString(36).substring(2, 6).toUpperCase();
    const batchRef = `BT-${dateTag}-${randomTag}`;

    const isAdminCreator = role === 'admin';
    const initialStatus = isAdminCreator ? 'approved' : 'draft';
    const now = new Date().toISOString();

    // ── Attempt atomic stored procedure (transaction) ──────────────────────
    let batchId: number | null = null;
    let usedRpc = false;

    try {
      const rpcItems = items.map((i: any) => ({
        salesperson_id: i.salesperson_id,
        sales_log_id: i.sales_log_id || null,
        adjustment_id: i.adjustment_id || null,
        amount: i.amount,
        description: i.description || "",
      }));

      const { data: rpcResult, error: rpcErr } = await supabase.rpc('create_incentive_batch', {
        p_batch_name: batch_name,
        p_created_by: session.id,
        p_status: initialStatus,
        p_total_amount: totalAmount,
        p_period_start: period_start || null,
        p_period_end: period_end || null,
        p_reference_number: batchRef,
        p_idempotency_key: idempotencyKey,
        p_submitted_at: isAdminCreator ? now : null,
        p_approved_by: isAdminCreator ? session.id : null,
        p_approved_at: isAdminCreator ? now : null,
        p_items: JSON.stringify(rpcItems),
        p_log_ids: JSON.stringify(logIds),
        p_adj_ids: JSON.stringify(adjIds),
      });

      if (rpcErr) {
        // Code 42883 = function does not exist (migration not yet run)
        if (!(rpcErr as any).code || (rpcErr as any).code === '42883') throw rpcErr;
        throw rpcErr;
      }

      const result = rpcResult as any;
      if (result?.duplicate) {
        return NextResponse.json(
          { id: result.id, message: "Batch already created (idempotent)" },
          { status: 200 }
        );
      }
      batchId = result?.id;
      usedRpc = true;
    } catch (rpcError: any) {
      // RPC not available — fall back to sequential inserts with compensation
      console.warn("[BATCH_POST] RPC unavailable, using sequential fallback:", rpcError.message);

      // Validate items availability first
      if (logIds.length > 0) {
        const { data: logs } = await supabase
          .from('sales_logs')
          .select('status, id, dispute_status')
          .in('id', logIds);
        const invalid = logs?.filter(l => l.status !== 'earned' || l.dispute_status === 'flagged');
        if (invalid && invalid.length > 0) {
          return NextResponse.json(
            { error: "One or more commission items are already assigned to another batch, paid, or currently flagged for review." },
            { status: 400 }
          );
        }
      }

      // Create batch row
      const { data: batch, error: bErr } = await supabase
        .from('incentive_batches')
        .insert({
          batch_name,
          created_by: session.id,
          status: initialStatus,
          total_amount: totalAmount,
          period_start: period_start || null,
          period_end: period_end || null,
          reference_number: batchRef,
          idempotency_key: idempotencyKey,
          ...(isAdminCreator && { submitted_at: now, approved_by: session.id, approved_at: now }),
        })
        .select('id')
        .single();

      if (bErr) throw bErr;
      batchId = batch.id;

      // Insert items — compensate (delete batch) if this fails
      const itemsToInsert = items.map((i: any) => ({
        batch_id: batchId,
        salesperson_id: i.salesperson_id,
        sales_log_id: i.sales_log_id || null,
        adjustment_id: i.adjustment_id || null,
        amount: i.amount,
        description: i.description || "",
      }));

      const { error: iErr } = await supabase.from('batch_items').insert(itemsToInsert);
      if (iErr) {
        // Compensation: delete the orphaned batch row
        await supabase.from('incentive_batches').delete().eq('id', batchId);
        throw iErr;
      }

      // Update sales log statuses
      if (logIds.length > 0) {
        const { error: lErr } = await supabase
          .from('sales_logs')
          .update({ status: 'accrued', updated_at: now })
          .in('id', logIds);
        if (lErr) throw lErr;
      }

      // Update adjustment statuses
      if (adjIds.length > 0) {
        const { error: aErr } = await supabase
          .from('adjustments')
          .update({ status: 'applied', applied_at: now })
          .in('id', adjIds);
        if (aErr) throw aErr;
      }
    }

    // ── Audit ──────────────────────────────────────────────────────────────
    if (!usedRpc) {
      // RPC path already writes audit inside the transaction; fallback needs it here
      await supabase.from('audit_logs').insert({
        user_id: session.id,
        action: 'CREATE',
        entity_type: 'incentive_batch',
        entity_id: batchId,
        new_value: JSON.stringify({ batch_name, items_count: items.length, total: totalAmount }),
      });
    }

    // ── Notifications ──────────────────────────────────────────────────────
    try {
      const { data: accountsList } = await supabase
        .from('users')
        .select('id, email, roles!inner(name)')
        .eq('roles.name', 'accounts')
        .eq('is_active', true);

      if (accountsList) {
        const noticeMsg = isAdminCreator
          ? `Batch "${batch_name}" (REF: ${batchRef}) has been created and auto-approved by an Administrator. It is ready for payment processing.`
          : `A new payout bundle "${batch_name}" (REF: ${batchRef}) has been drafted and is awaiting managerial submission.`;

        for (const acc of accountsList as any[]) {
          if (isAdminCreator && acc.id) {
            await supabase.from('notifications').insert({
              user_id: acc.id,
              title: 'Batch Ready for Payment',
              message: `"${batch_name}" (₹${totalAmount.toLocaleString()}) was approved by admin and awaits disbursement.`,
              type: 'info',
            });
          }
          if (acc.email) {
            await sendIncentiveUpdate(acc.email, "Accounts Team", noticeMsg, totalAmount);
          }
        }
      }
    } catch (e) {
      console.warn("Notification error:", e);
    }

    return NextResponse.json({ id: batchId, message: "Batch created successfully" });
  } catch (error: any) {
    console.error("[BATCH_POST_ERROR]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
