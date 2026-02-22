import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const dateFrom = url.searchParams.get("from");
  const dateTo = url.searchParams.get("to");

  // Date filter conditions for sales
  const salesConditions: string[] = [];
  const salesParams: any[] = [];
  if (dateFrom) { salesConditions.push("sale_date >= ?"); salesParams.push(dateFrom); }
  if (dateTo) { salesConditions.push("sale_date <= ?"); salesParams.push(`${dateTo} 23:59:59`); }
  const salesWhere = salesConditions.length ? " WHERE " + salesConditions.join(" AND ") : "";

  // Date filter for batches
  const batchConditions: string[] = [];
  const batchParams: any[] = [];
  if (dateFrom) { batchConditions.push("date(ib.created_at) >= ?"); batchParams.push(dateFrom); }
  if (dateTo) { batchConditions.push("date(ib.created_at) <= ?"); batchParams.push(dateTo); }
  const batchWhere = batchConditions.length ? " AND " + batchConditions.join(" AND ") : "";

  // Revenue vs Incentive trend
  const monthlyRevenue = await db.prepare(`
    SELECT to_char(sale_date, 'YYYY-MM') as month, 
      SUM(deal_value) as revenue, 
      SUM(calculated_commission) as incentives
    FROM public.sales_logs ${salesWhere} GROUP BY month ORDER BY month
  `).all(...salesParams);

  // Top performers
  const topPerformers = await db.prepare(`
    SELECT u.full_name, COUNT(sl.id) as deals, SUM(sl.deal_value) as total_sales, SUM(sl.calculated_commission) as total_incentives
    FROM public.sales_logs sl JOIN public.users u ON sl.salesperson_id = u.id
    ${salesWhere ? salesWhere.replace(/sale_date/g, "sl.sale_date") : ""}
    GROUP BY u.full_name ORDER BY total_sales DESC LIMIT 10
  `).all(...salesParams);

  // Disbursement aging
  const aging = await db.prepare(`
    SELECT ib.id, ib.batch_name, ib.status, ib.total_amount, ib.created_at, ib.approved_at, ib.paid_at,
    CASE 
      WHEN ib.status = 'paid' AND ib.approved_at IS NOT NULL THEN (ib.paid_at::date - ib.approved_at::date)
      WHEN ib.status = 'approved' AND ib.approved_at IS NOT NULL THEN (now()::date - ib.approved_at::date)
      ELSE (now()::date - ib.created_at::date)
    END as days_pending
    FROM public.incentive_batches ib
    WHERE ib.status IN ('approved', 'pending_approval', 'paid') ${batchWhere}
    ORDER BY days_pending DESC
  `).all(...batchParams);

  // Status distribution
  const statusConditions: string[] = [];
  const statusParams: any[] = [];
  if (dateFrom) { statusConditions.push("date(created_at) >= ?"); statusParams.push(dateFrom); }
  if (dateTo) { statusConditions.push("date(created_at) <= ?"); statusParams.push(dateTo); }
  const statusWhere = statusConditions.length ? " WHERE " + statusConditions.join(" AND ") : "";

  const statusDist = await db.prepare(`
    SELECT status, COUNT(*) as count, COALESCE(SUM(total_amount),0) as total
    FROM public.incentive_batches ${statusWhere} GROUP BY status
  `).all(...statusParams);

  // Forecasting: Simple run-rate projection for the current month
  const now = new Date();
  const dayOfMonth = Math.max(1, now.getDate());
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const currentMonthSalesResult = await db.prepare(`
    SELECT COALESCE(SUM(deal_value),0) as s FROM public.sales_logs 
    WHERE to_char(sale_date, 'MM') = ? AND to_char(sale_date, 'YYYY') = ?
  `).get(
    (now.getMonth() + 1).toString().padStart(2, '0'),
    now.getFullYear().toString()
  ) as any;
  const currentMonthSales = currentMonthSalesResult?.s || 0;

  const forecastRevenue = Math.round((currentMonthSales / dayOfMonth) * daysInMonth);

  return NextResponse.json({
    monthlyRevenue,
    topPerformers,
    aging,
    statusDist,
    forecast: {
      currentMonth: currentMonthSales,
      projectedEOM: forecastRevenue,
      confidence: dayOfMonth > 20 ? "High" : "Medium"
    }
  });
}
