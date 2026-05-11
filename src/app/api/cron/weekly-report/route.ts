/**
 * Weekly Performance Report Cron (Priority 4.5)
 *
 * Runs every Monday at 8:00 AM (via Vercel Cron).
 * Sends a performance summary email to all admins and managers.
 *
 * Secured by CRON_SECRET env var.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateApiKey, unauthorizedApiResponse } from "@/lib/api-keys";
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
  if (!validateApiKey(req, "CRON_SECRET")) return unauthorizedApiResponse();

  const supabase = getSupabase();

  try {
    // 7-day window
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const from = weekAgo.toISOString().split("T")[0];
    const to = now.toISOString().split("T")[0];

    // Fetch this week's data
    const [salesRes, batchRes] = await Promise.all([
      supabase.from("sales_logs").select("deal_value, calculated_commission, status, users!salesperson_id(full_name)")
        .gte("sale_date", from).lte("sale_date", to),
      supabase.from("incentive_batches").select("status, total_amount")
        .gte("created_at", from).is("deleted_at", null),
    ]);

    const sales = salesRes.data || [];
    const batches = batchRes.data || [];

    const totalRevenue = sales.reduce((s: number, l: any) => s + (l.deal_value || 0), 0);
    const totalCommission = sales.reduce((s: number, l: any) => s + (l.calculated_commission || 0), 0);
    const pendingBatches = batches.filter((b: any) => b.status === "pending_approval").length;
    const paidOut = batches.filter((b: any) => b.status === "paid").reduce((s: number, b: any) => s + (b.total_amount || 0), 0);

    // Top 3 performers this week
    const perfMap: Record<string, number> = {};
    sales.forEach((s: any) => {
      const name = (s.users as any)?.full_name || "Unknown";
      perfMap[name] = (perfMap[name] || 0) + (s.deal_value || 0);
    });
    const top3 = Object.entries(perfMap).sort(([, a], [, b]) => b - a).slice(0, 3);

    const topLines = top3.length
      ? top3.map(([name, rev], i) => `${i + 1}. ${name} — ₹${rev.toLocaleString("en-IN")}`).join("\n")
      : "No sales logged this week";

    const summary = `
Weekly Performance Summary (${from} to ${to})

📊 Revenue: ₹${totalRevenue.toLocaleString("en-IN")}
💰 Commissions: ₹${totalCommission.toLocaleString("en-IN")}
⏳ Batches Pending Approval: ${pendingBatches}
✅ Paid Out This Week: ₹${paidOut.toLocaleString("en-IN")}

🏆 Top Performers:
${topLines}

Log in to view the full analytics dashboard.
    `.trim();

    // Send to all active admins and managers
    const { data: recipients } = await supabase
      .from("users")
      .select("email, full_name, role_id")
      .in("role_id", [1, 2])  // 1=admin, 2=manager
      .eq("is_active", true);

    let sent = 0;
    for (const r of (recipients || [])) {
      if (!r.email) continue;
      await sendIncentiveUpdate(r.email, r.full_name, summary, totalCommission).catch(() => {});
      sent++;
    }

    await supabase.from("cron_runs").insert({
      job_name: "weekly-report",
      status: "success",
      message: `Sent to ${sent} recipients. Revenue: ₹${totalRevenue.toLocaleString("en-IN")}`,
    });

    return NextResponse.json({ message: "Weekly report sent", recipients: sent });
  } catch (err: any) {
    console.error("[WEEKLY_REPORT_CRON_ERROR]", err.message);
    await supabase.from("cron_runs").insert({ job_name: "weekly-report", status: "failure", message: err.message }).catch(() => {});
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
