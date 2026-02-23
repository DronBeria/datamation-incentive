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
    const dateFrom = url.searchParams.get("from");
    const dateTo = url.searchParams.get("to");
    const supabase = getSupabase();

    // 1. Fetch Sales Data for Trend & Performers
    let salesQuery = supabase.from('sales_logs').select('*, user:users(full_name)');
    if (dateFrom) salesQuery = salesQuery.gte('sale_date', dateFrom);
    if (dateTo) salesQuery = salesQuery.lte('sale_date', `${dateTo} 23:59:59`);

    const { data: sales, error: sErr } = await salesQuery;
    if (sErr) throw sErr;

    // 2. Fetch Batch Data for Aging & Status Distribution
    let batchQuery = supabase.from('incentive_batches').select('*');
    if (dateFrom) batchQuery = batchQuery.gte('created_at', dateFrom);
    if (dateTo) batchQuery = batchQuery.lte('created_at', `${dateTo} 23:59:59`);

    const { data: batches, error: bErr } = await batchQuery;
    if (bErr) throw bErr;

    // 3. Process Trends (In JS for maximum reliability vs SQL dialects)
    const trendMap: Record<string, { month: string, revenue: number, incentives: number }> = {};
    (sales || []).forEach(s => {
      const month = s.sale_date.substring(0, 7); // YYYY-MM
      if (!trendMap[month]) trendMap[month] = { month, revenue: 0, incentives: 0 };
      trendMap[month].revenue += (s.deal_value || 0);
      trendMap[month].incentives += (s.calculated_commission || 0);
    });
    const monthlyRevenue = Object.values(trendMap).sort((a, b) => a.month.localeCompare(b.month));

    // 4. Process Top Performers
    const staffMap: Record<string, { full_name: string, deals: number, total_sales: number, total_incentives: number }> = {};
    (sales || []).forEach(s => {
      const name = s.user?.full_name || 'Individual';
      if (!staffMap[name]) staffMap[name] = { full_name: name, deals: 0, total_sales: 0, total_incentives: 0 };
      staffMap[name].deals += 1;
      staffMap[name].total_sales += (s.deal_value || 0);
      staffMap[name].total_incentives += (s.calculated_commission || 0);
    });
    const topPerformers = Object.values(staffMap).sort((a, b) => b.total_sales - a.total_sales).slice(0, 10);

    // 5. Aging & Status
    const today = new Date();
    const aging = (batches || [])
      .filter(b => ['approved', 'pending_approval', 'paid'].includes(b.status))
      .map(b => {
        const start = b.approved_at ? new Date(b.approved_at) : new Date(b.created_at);
        const end = b.paid_at ? new Date(b.paid_at) : today;
        const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
        return { ...b, days_pending: days };
      })
      .sort((a, b) => b.days_pending - a.days_pending);

    const statusMap: Record<string, { status: string, count: number, total: number }> = {};
    (batches || []).forEach(b => {
      if (!statusMap[b.status]) statusMap[b.status] = { status: b.status, count: 0, total: 0 };
      statusMap[b.status].count += 1;
      statusMap[b.status].total += (b.total_amount || 0);
    });
    const statusDist = Object.values(statusMap);

    // 6. Forecasting
    const now = new Date();
    const dayOfMonth = Math.max(1, now.getDate());
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const curMonthKey = now.toISOString().substring(0, 7);
    const currentMonthSales = (sales || [])
      .filter(s => s.sale_date.startsWith(curMonthKey))
      .reduce((sum, s) => sum + (s.deal_value || 0), 0);

    const projectedEOM = Math.round((currentMonthSales / dayOfMonth) * daysInMonth);

    return NextResponse.json({
      monthlyRevenue,
      topPerformers,
      aging,
      statusDist,
      forecast: {
        currentMonth: currentMonthSales,
        projectedEOM,
        confidence: dayOfMonth > 20 ? "High" : "Medium"
      }
    });

  } catch (error: any) {
    console.error("[REPORTS_GET_ERROR]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
