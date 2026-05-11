/**
 * Auto-Batch Cron Job (Priority 5.2)
 *
 * Runs on the 1st of each month (via Vercel Cron).
 * Sweeps all 'earned' commission records, groups them by salesperson,
 * and creates a draft batch for admin review.
 *
 * If the system setting 'auto_batch_auto_approve' is 'true' AND the caller
 * is an admin, the batch is created in 'approved' state immediately.
 *
 * Secured by CRON_SECRET env var.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateApiKey, unauthorizedApiResponse } from "@/lib/api-keys";

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
  const now = new Date().toISOString();
  const results: string[] = [];

  try {
    // 1. Fetch all earned sales logs (not already batched)
    const { data: earned, error: earnedErr } = await supabase
      .from("sales_logs")
      .select("id, salesperson_id, calculated_commission, client_name, users!salesperson_id(full_name)")
      .eq("status", "earned")
      .neq("dispute_status", "flagged");

    if (earnedErr) throw earnedErr;
    if (!earned?.length) {
      await supabase.from("cron_runs").insert({ job_name: "auto-batch", status: "success", message: "No earned commissions to batch" });
      return NextResponse.json({ message: "No earned commissions — nothing to batch", batched: 0 });
    }

    // 2. Fetch pending adjustments
    const { data: adjs } = await supabase
      .from("adjustments")
      .select("id, user_id, amount, reason, type, users!user_id(full_name)")
      .eq("status", "pending")
      .is("deleted_at", null);

    // 3. Group by salesperson
    const byPerson: Record<string, { sales: any[]; adjustments: any[]; name: string }> = {};

    (earned || []).forEach((s: any) => {
      const id = s.salesperson_id;
      if (!byPerson[id]) byPerson[id] = { sales: [], adjustments: [], name: s.users?.full_name || "Unknown" };
      byPerson[id].sales.push(s);
    });

    (adjs || []).forEach((a: any) => {
      const id = a.user_id;
      if (!byPerson[id]) byPerson[id] = { sales: [], adjustments: [], name: a.users?.full_name || "Unknown" };
      byPerson[id].adjustments.push(a);
    });

    const month = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    const dateTag = now.split("T")[0].replace(/-/g, "");
    let batchCount = 0;

    // 4. Create one batch per salesperson
    for (const [spId, group] of Object.entries(byPerson)) {
      if (!group.sales.length && !group.adjustments.length) continue;

      const totalAmount = [
        ...group.sales.map((s: any) => s.calculated_commission || 0),
        ...group.adjustments.map((a: any) => (a.type === "clawback" ? -a.amount : a.amount)),
      ].reduce((s, v) => s + v, 0);

      if (totalAmount <= 0) continue;

      const batchRef = `BT-AUTO-${dateTag}-${spId.slice(-4).toUpperCase()}`;
      const batchName = `Auto-Batch ${month} — ${group.name}`;

      const { data: batch, error: batchErr } = await supabase
        .from("incentive_batches")
        .insert({
          batch_name: batchName,
          created_by: spId, // system-created, attributed to salesperson for audit
          status: "draft",
          total_amount: totalAmount,
          reference_number: batchRef,
          idempotency_key: `auto-${dateTag}-${spId}`,
        })
        .select("id")
        .single();

      if (batchErr) { results.push(`SKIP ${group.name}: ${batchErr.message}`); continue; }

      // Insert items
      const itemsToInsert = [
        ...group.sales.map((s: any) => ({
          batch_id: batch.id,
          salesperson_id: spId,
          sales_log_id: s.id,
          amount: s.calculated_commission,
          description: `Commission for ${s.client_name}`,
        })),
        ...group.adjustments.map((a: any) => ({
          batch_id: batch.id,
          salesperson_id: spId,
          adjustment_id: a.id,
          amount: a.type === "clawback" ? -a.amount : a.amount,
          description: a.reason,
        })),
      ];

      await supabase.from("batch_items").insert(itemsToInsert);

      // Update statuses
      if (group.sales.length) {
        await supabase.from("sales_logs").update({ status: "accrued" }).in("id", group.sales.map((s: any) => s.id));
      }
      if (group.adjustments.length) {
        await supabase.from("adjustments").update({ status: "applied" }).in("id", group.adjustments.map((a: any) => a.id));
      }

      batchCount++;
      results.push(`Created: ${batchName} (₹${totalAmount.toLocaleString("en-IN")})`);
    }

    // 5. Notify admins
    const { data: admins } = await supabase.from("users").select("id").eq("role_id", 1).eq("is_active", true);
    for (const admin of (admins || [])) {
      await supabase.from("notifications").insert({
        user_id: admin.id,
        title: "Auto-Batch Created",
        message: `${batchCount} draft batch(es) were automatically created for ${month}. Review and approve them.`,
        type: "info",
      });
    }

    await supabase.from("cron_runs").insert({
      job_name: "auto-batch",
      status: "success",
      message: `Created ${batchCount} batches: ${results.join("; ")}`,
    });

    return NextResponse.json({ message: `Auto-batch complete`, batched: batchCount, details: results });
  } catch (err: any) {
    console.error("[AUTO_BATCH_CRON_ERROR]", err.message);
    await supabase.from("cron_runs").insert({ job_name: "auto-batch", status: "failure", message: err.message }).catch(() => {});
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
