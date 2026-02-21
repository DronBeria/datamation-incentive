import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendIncentiveUpdate } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const dateFrom = url.searchParams.get("from");
  const dateTo = url.searchParams.get("to");

  let query = `
    SELECT ib.*, u.full_name as created_by_name, 
    a.full_name as approved_by_name,
    p.full_name as paid_by_name
    FROM public.incentive_batches ib 
    LEFT JOIN public.users u ON ib.created_by = u.id
    LEFT JOIN public.users a ON ib.approved_by = a.id
    LEFT JOIN public.users p ON ib.paid_by = p.id
  `;
  const conditions: string[] = [];
  const params: any[] = [];

  if (session.role === "accounts") {
    conditions.push("ib.status IN ('approved', 'paid')");
  } else if (session.role === "manager") {
    conditions.push("ib.created_by = ?");
    params.push(session.id);
  } else if (session.role === "salesperson") {
    conditions.push("ib.id IN (SELECT batch_id FROM batch_items WHERE salesperson_id = ?)");
    params.push(session.id);
  }

  if (status) {
    conditions.push("ib.status = ?");
    params.push(status);
  }

  if (dateFrom) {
    conditions.push("ib.created_at >= ?");
    params.push(dateFrom);
  }

  if (dateTo) {
    conditions.push("ib.created_at <= ?");
    params.push(`${dateTo} 23:59:59`);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY ib.created_at DESC";

  try {
    const batches = await db.prepare(query).all(...params) as any[];

    if (batches.length === 0) {
      return NextResponse.json([]);
    }

    const batchIds = batches.map(b => b.id);
    const items = await db.prepare(`
      SELECT bi.*, u.full_name as salesperson_name, sl.client_name, sl.deal_value
      FROM public.batch_items bi 
      LEFT JOIN public.users u ON bi.salesperson_id = u.id
      LEFT JOIN public.sales_logs sl ON bi.sales_log_id = sl.id
      WHERE bi.batch_id IN (${batchIds.map(() => '?').join(', ')})
    `).all(...batchIds) as any[];

    // Optimize merging: use a lookup table (O(N+M) instead of O(N*M))
    const itemsByBatchId: Record<string, any[]> = {};
    if (Array.isArray(items)) {
      for (const item of items) {
        if (!itemsByBatchId[item.batch_id]) itemsByBatchId[item.batch_id] = [];
        itemsByBatchId[item.batch_id].push(item);
      }
    }

    const batchesWithItems = batches.map(b => ({
      ...b,
      items: itemsByBatchId[b.id] || []
    }));

    return NextResponse.json(batchesWithItems);
  } catch (error: any) {
    console.error("[BATCHES_GET_ERROR]", error.message);
    return NextResponse.json({ error: "Internal ledger synchronization failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !["admin", "manager"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { batch_name, period_start, period_end, items } = body;

  if (!batch_name || !items?.length) {
    return NextResponse.json({ error: "Batch name and items required" }, { status: 400 });
  }

  const totalAmount = items.reduce((s: number, i: any) => s + (i.amount || 0), 0);

  try {
    // PERFORM ATOMIC BULK TRANSACTION
    // 1. Create Batch
    // 2. Insert all Items via JSON
    // 3. Update all Sales Logs to 'accrued'
    const bulkSql = `
        WITH new_batch AS (
          INSERT INTO public.incentive_batches (batch_name, created_by, status, total_amount, period_start, period_end, created_at, updated_at)
          VALUES ('${batch_name.replace(/'/g, "''")}', '${session.id}', 'draft', ${totalAmount}, ${period_start ? `'${period_start}'` : 'NULL'}, ${period_end ? `'${period_end}'` : 'NULL'}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING id
        ),
        items_insertion AS (
          INSERT INTO public.batch_items (batch_id, salesperson_id, sales_log_id, amount, description)
          SELECT (SELECT id FROM new_batch), salesperson_id::bigint, sales_log_id::bigint, amount, description
          FROM jsonb_to_recordset('${JSON.stringify(items).replace(/'/g, "''")}'::jsonb) 
          AS x(salesperson_id text, sales_log_id text, amount numeric, description text)
          RETURNING batch_id
        ),
        logs_update AS (
          UPDATE public.sales_logs 
          SET status = 'accrued', updated_at = CURRENT_TIMESTAMP
          WHERE id IN (
            SELECT sales_log_id::bigint FROM jsonb_to_recordset('${JSON.stringify(items).replace(/'/g, "''")}'::jsonb) 
            AS x(sales_log_id text) WHERE sales_log_id IS NOT NULL
          )
          RETURNING id
        )
        SELECT id FROM new_batch;
      `;

    const result = await db.prepare(bulkSql).get();
    const batchId = result?.id;

    if (!batchId) {
      throw new Error("Batch record collation failed - check transaction log");
    }

    // Audit Recording
    await db.prepare(
      "INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_value) VALUES (?, 'CREATE', 'incentive_batch', ?, ?)"
    ).run(session.id, batchId, JSON.stringify({ status: "draft", total: totalAmount, items_count: items.length }));

    // Industrial Email Notification (Non-blocking)
    try {
      const accountsUsers = await db.prepare("SELECT email FROM public.users WHERE role_id = (SELECT id FROM public.roles WHERE name = 'accounts' LIMIT 1)").all();
      for (const acc of accountsUsers as any[]) {
        await sendIncentiveUpdate(acc.email, "Accounts Team", `New Batch Draft: ${batch_name}`, totalAmount);
      }
    } catch (e) { console.warn("Background notification deferred", e); }

    return NextResponse.json({
      id: batchId,
      message: "Incentive payout batch successfully indexed",
      items_processed: items.length
    });

  } catch (err: any) {
    console.error("[BATCH_POST_CRASH]", err.message);
    return NextResponse.json({ error: "Batch creation failed: " + err.message }, { status: 500 });
  }
}
