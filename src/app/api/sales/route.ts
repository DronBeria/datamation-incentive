import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const dateFrom = url.searchParams.get("from");
  const dateTo = url.searchParams.get("to");

  const conditions: string[] = [];
  const params: any[] = [];

  // Security: Salesperson only sees their own
  if (session.role === "salesperson") {
    conditions.push("sl.salesperson_id = ?");
    params.push(session.id);
  } else if (session.role === "manager") {
    // Managers see their team's logs
    conditions.push("(sl.salesperson_id IN (SELECT id FROM public.users WHERE manager_id = ?) OR sl.salesperson_id = ?)");
    params.push(session.id, session.id);
  }

  if (status) {
    conditions.push("sl.status = ?");
    params.push(status);
  }

  if (dateFrom) {
    conditions.push("sl.sale_date >= ?");
    params.push(dateFrom);
  }

  if (dateTo) {
    conditions.push("sl.sale_date <= ?");
    params.push(dateTo);
  }

  try {
    let query = `
      SELECT 
        sl.*, 
        u.full_name as salesperson_name,
        sch.name as scheme_name,
        sch.calculation_type,
        sch.base_rate
      FROM public.sales_logs sl 
      JOIN public.users u ON sl.salesperson_id = u.id
      LEFT JOIN public.incentive_schemes sch ON sl.scheme_id = sch.id
    `;

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY sl.sale_date DESC";

    const logs = await db.prepare(query).all(...params);
    return NextResponse.json(logs);
  } catch (error: any) {
    console.error("[SALES_GET_ERROR]", error.message);
    return NextResponse.json({ error: "Sales ledger retrieval failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !["salesperson", "manager", "admin"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { salesperson_id, client_name, deal_value, product, sale_date, quantity, custom_commission, is_custom } = body;

  const spId = session.role === "salesperson" ? session.id : (salesperson_id || session.id);
  if (!client_name || !deal_value || !sale_date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Find active scheme
  const assignment = await db.prepare(`
    SELECT sa.scheme_id, sch.*, u.manager_id
    FROM user_scheme_assignments sa
    JOIN incentive_schemes sch ON sa.scheme_id = sch.id
    JOIN users u ON sa.user_id = u.id
    WHERE sa.user_id = ? AND (sa.end_date IS NULL OR sa.end_date >= CURRENT_DATE)
    LIMIT 1
  `).get(spId) as any;

  let calculatedCommission = 0;
  let schemeId = null;
  const qty = parseFloat(quantity) || 1;
  const val = parseFloat(deal_value);

  // CUSTOM AGREEMENT LOGIC
  if (is_custom && ["admin", "manager"].includes(session.role)) {
    calculatedCommission = parseFloat(custom_commission) || 0;
    schemeId = null; // Overriding standard scheme
  } else if (assignment) {
    schemeId = assignment.scheme_id;
    const { calculation_type, base_rate, target_threshold, bonus_rate } = assignment;

    if (calculation_type === 'percentage') {
      calculatedCommission = val * base_rate;
    } else if (calculation_type === 'tier_based') {
      calculatedCommission = val >= target_threshold
        ? val * bonus_rate
        : val * base_rate;
    } else if (calculation_type === 'fixed_per_qty') {
      calculatedCommission = base_rate * qty;
    } else if (calculation_type === 'quantity_threshold') {
      calculatedCommission = qty >= target_threshold
        ? bonus_rate * qty
        : base_rate * qty;
    }
  } else {
    calculatedCommission = val * 0.05; // Default fallback
  }

  const managerOverride = assignment?.manager_id ? (calculatedCommission * 0.10) : 0;

  // IMPORTANT: All entries start as 'pending_review' 
  // unless Admin/Manager specifically wants to auto-approve (handled in UI via separate endpoint)
  const status = 'pending_review';

  const result = await db.prepare(`
    INSERT INTO sales_logs 
    (salesperson_id, client_name, deal_value, product, sale_date, scheme_id, calculated_commission, override_commission, status, notes, quantity) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).run(
    spId, client_name, val, product || "", sale_date, schemeId,
    calculatedCommission, managerOverride, status, body.notes || (is_custom ? "Custom Agreement Applied" : ""), qty
  );

  const newId = result.lastInsertRowid;

  await db.prepare(
    "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value) VALUES (?, 'CREATE', 'sales_log', ?, ?)"
  ).run(session.id, newId, JSON.stringify({
    client_name, deal_value: val, commission: calculatedCommission, status, quantity: qty, is_custom: !!is_custom
  }));

  return NextResponse.json({
    id: newId,
    commission: calculatedCommission,
    status,
    message: "Transaction blueprint successfully indexed for review"
  });
}
