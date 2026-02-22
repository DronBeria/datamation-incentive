import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.role === "admin") {
    const [totalUsers, activeUsers, totalSales, totalCommissions, pendingBatches, totalAccrued, activeSchemes, globalPendingLogs, pendingUsersCount] = await Promise.all([
      db.prepare("SELECT COUNT(*) as c FROM public.users").get(),
      db.prepare("SELECT COUNT(*) as c FROM public.users WHERE is_active=TRUE").get(),
      db.prepare("SELECT COALESCE(SUM(deal_value),0) as s FROM public.sales_logs").get(),
      db.prepare("SELECT COALESCE(SUM(calculated_commission),0) as s FROM public.sales_logs").get(),
      db.prepare("SELECT COUNT(*) as c FROM public.incentive_batches WHERE status='pending_approval'").get(),
      db.prepare("SELECT COALESCE(SUM(calculated_commission + override_commission),0) as s FROM public.sales_logs WHERE status='accrued'").get(),
      db.prepare("SELECT COUNT(*) as c FROM public.incentive_schemes").get(),
      db.prepare("SELECT COUNT(*) as c FROM public.sales_logs WHERE status='pending_review'").get(),
      db.prepare("SELECT COUNT(*) as c FROM public.users WHERE approval_status='pending'").get()
    ]);

    const recentAudit = await db.prepare(`
        SELECT al.*, u.full_name FROM public.audit_logs al 
        LEFT JOIN public.users u ON al.user_id = u.id 
        ORDER BY al.created_at DESC LIMIT 5
  `).all();

    const stats = {
      totalUsers: (totalUsers as any)?.c || 0,
      activeUsers: (activeUsers as any)?.c || 0,
      totalSales: (totalSales as any)?.s || 0,
      totalCommissions: (totalCommissions as any)?.s || 0,
      pendingBatches: (pendingBatches as any)?.c || 0,
      totalAccrued: (totalAccrued as any)?.s || 0,
      activeSchemes: (activeSchemes as any)?.c || 0,
      globalPendingLogs: (globalPendingLogs as any)?.c || 0,
      pendingUsers: (pendingUsersCount as any)?.c || 0,
      recentAudit: Array.isArray(recentAudit) ? recentAudit : [],
    };
    return NextResponse.json(stats);
  }

  if (session.role === "manager") {
    const [totalMembers, activeMembers, teamSales, totalOverrides, pendingBatches, pendingReviewLogs, activeSchemes] = await Promise.all([
      db.prepare("SELECT COUNT(*) as c FROM public.users WHERE manager_id=?").get(session.id),
      db.prepare("SELECT COUNT(*) as c FROM public.users WHERE manager_id=? AND is_active=TRUE").get(session.id),
      db.prepare("SELECT COALESCE(SUM(deal_value),0) as s FROM public.sales_logs WHERE salesperson_id IN (SELECT id FROM public.users WHERE manager_id=? OR id=?)").get(session.id, session.id),
      db.prepare("SELECT COALESCE(SUM(override_commission),0) as s FROM public.sales_logs WHERE salesperson_id IN (SELECT id FROM public.users WHERE manager_id=?)").get(session.id),
      db.prepare("SELECT COUNT(*) as c FROM public.incentive_batches WHERE status='pending_approval' AND created_by=?").get(session.id),
      db.prepare("SELECT COUNT(*) as c FROM public.sales_logs WHERE status='pending_review' AND salesperson_id IN (SELECT id FROM public.users WHERE manager_id=?)").get(session.id),
      db.prepare("SELECT COUNT(*) as c FROM public.incentive_schemes").get()
    ]);

    const recentAudit = await db.prepare(`
      SELECT al.*, u.full_name FROM public.audit_logs al 
      LEFT JOIN public.users u ON al.user_id = u.id 
      WHERE al.user_id = ? OR al.user_id IN (SELECT id FROM public.users WHERE manager_id = ?)
      ORDER BY al.created_at DESC LIMIT 5
    `).all(session.id, session.id);

    const stats = {
      teamMembers: (totalMembers as any)?.c || 0,
      activeMembers: (activeMembers as any)?.c || 0,
      totalUsers: (totalMembers as any)?.c || 0, // For KPI compatibility
      activeUsers: (activeMembers as any)?.c || 0,
      totalSales: (teamSales as any)?.s || 0,
      totalCommissions: (totalOverrides as any)?.s || 0, // Manager's override view
      pendingBatches: (pendingBatches as any)?.c || 0,
      pendingReviewLogs: (pendingReviewLogs as any)?.c || 0,
      activeSchemes: (activeSchemes as any)?.c || 0,
      recentAudit: Array.isArray(recentAudit) ? recentAudit : [],
    };
    return NextResponse.json(stats);
  }

  if (session.role === "accounts") {
    const [approvedCount, approvedAmount, totalLiability] = await Promise.all([
      db.prepare("SELECT COUNT(*) as c FROM public.incentive_batches WHERE status='approved'").get(),
      db.prepare("SELECT COALESCE(SUM(total_amount),0) as s FROM public.incentive_batches WHERE status='approved'").get(),
      db.prepare("SELECT COALESCE(SUM(calculated_commission + override_commission),0) as s FROM public.sales_logs WHERE status='accrued'").get()
    ]);

    const stats = {
      approvedForPayment: (approvedCount as any)?.c || 0,
      approvedAmount: (approvedAmount as any)?.s || 0,
      totalLiability: (totalLiability as any)?.s || 0,
    };
    return NextResponse.json(stats);
  }

  // Salesperson
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();

  const [quota, currentSales, activeScheme, totalSales, earned, accrued, paid, pending] = await Promise.all([
    db.prepare("SELECT target_amount FROM public.quotas WHERE user_id=? AND period_month=? AND period_year=?").get(session.id, month, year),
    db.prepare("SELECT COALESCE(SUM(deal_value),0) as s FROM public.sales_logs WHERE salesperson_id=? AND EXTRACT(MONTH FROM sale_date) = ? AND EXTRACT(YEAR FROM sale_date) = ?").get(session.id, month, year),
    db.prepare("SELECT sch.name, sch.calculation_type, sch.base_rate FROM public.user_scheme_assignments sa JOIN public.incentive_schemes sch ON sa.scheme_id = sch.id WHERE sa.user_id=? AND (sa.end_date IS NULL OR sa.end_date >= CURRENT_DATE) LIMIT 1").get(session.id),
    db.prepare("SELECT COALESCE(SUM(deal_value),0) as s FROM public.sales_logs WHERE salesperson_id=?").get(session.id),
    db.prepare("SELECT COALESCE(SUM(calculated_commission),0) as s FROM public.sales_logs WHERE salesperson_id=? AND status='earned'").get(session.id),
    db.prepare("SELECT COALESCE(SUM(calculated_commission),0) as s FROM public.sales_logs WHERE salesperson_id=? AND status='accrued'").get(session.id),
    db.prepare("SELECT COALESCE(SUM(calculated_commission),0) as s FROM public.sales_logs WHERE salesperson_id=? AND status='paid'").get(session.id),
    db.prepare("SELECT COALESCE(SUM(calculated_commission),0) as s FROM public.sales_logs WHERE salesperson_id=? AND status='pending_review'").get(session.id)
  ]);

  const target_amount = (quota as any)?.target_amount || 0;
  const sales_val = (currentSales as any)?.s || 0;
  const progress = target_amount ? Math.round((sales_val / target_amount) * 100) : 0;

  const stats = {
    activeScheme: activeScheme || null,
    totalSales: (totalSales as any)?.s || 0,
    earnedIncentives: (earned as any)?.s || 0,
    accruedIncentives: (accrued as any)?.s || 0,
    paidIncentives: (paid as any)?.s || 0,
    pendingIncentives: (pending as any)?.s || 0,
    targetProgress: progress,
    monthlySales: sales_val,
    monthlyTarget: target_amount,
  };
  return NextResponse.json(stats);
}
