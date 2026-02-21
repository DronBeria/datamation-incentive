import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendIncentiveUpdate } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const batchId = id; // use string ID for cloud
  const body = await req.json();
  const { action, rejection_reason } = body;

  try {
    const batch = await db.prepare("SELECT * FROM public.incentive_batches WHERE id = ?").get(batchId) as any;

    if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

    const oldStatus = batch.status;
    let newStatus = oldStatus;

    // New Industrial Workflow State Machine
    if (action === "submit") {
      if (oldStatus !== "draft" && oldStatus !== "rejected") return NextResponse.json({ error: "Only draft batches can be submitted" }, { status: 400 });
      if (!["manager", "admin"].includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      newStatus = "pending_approval";
      await db.prepare("UPDATE public.incentive_batches SET status = 'pending_approval', submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(batchId);

    } else if (action === "approve") {
      // ADMIN ONLY APPROVAL
      if (oldStatus !== "pending_approval") return NextResponse.json({ error: "Only pending batches can be approved" }, { status: 400 });
      if (session.role !== "admin") return NextResponse.json({ error: "Only administrators can grant final approval" }, { status: 403 });

      newStatus = "approved";
      await db.prepare("UPDATE public.incentive_batches SET status = 'approved', approved_at = CURRENT_TIMESTAMP, approved_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(session.id, batchId);

      // 1. Send Internal Notifications
      const salespersons = await db.prepare("SELECT DISTINCT salesperson_id FROM public.batch_items WHERE batch_id = ?").all(batchId) as any[];
      for (const sp of salespersons) {
        const amtData = await db.prepare("SELECT SUM(amount) as total FROM public.batch_items WHERE batch_id = ? AND salesperson_id = ?").get(batchId, sp.salesperson_id) as any;
        const totalAmount = amtData?.total || 0;

        // Internal Sidebar Notification
        await db.prepare("INSERT INTO public.notifications (user_id, title, message, type) VALUES (?, 'Commission Approved!', ?, 'success')")
          .run(sp.salesperson_id, `Your payment of ₹${totalAmount.toLocaleString()} has been approved by Admin and sent to Accounts.`);

        // 2. INDUSTRIAL EMAIL AUTOMATION - Triggered on Admin Approval
        const user = await db.prepare("SELECT email, full_name FROM public.users WHERE id = ?").get(sp.salesperson_id) as any;
        if (user?.email) {
          try {
            await sendIncentiveUpdate(user.email, user.full_name, `Incentive Approved: ${batch.batch_name}`, totalAmount);
          } catch (e) { console.warn("Email dispatch deferred", e); }
        }
      }

      // 3. Notify Accounts for Disbursement
      const accounts = await db.prepare("SELECT id FROM public.users WHERE role_id = (SELECT id FROM public.roles WHERE name = 'accounts' LIMIT 1)").all() as any[];
      for (const acc of accounts) {
        await db.prepare("INSERT INTO public.notifications (user_id, title, message, type) VALUES (?, 'Pending Disbursement', ?, 'info')")
          .run(acc.id, `Batch "${batch.batch_name}" (₹${batch.total_amount.toLocaleString()}) requires final payment.`);
      }

    } else if (action === "reject") {
      if (oldStatus !== "pending_approval") return NextResponse.json({ error: "Only pending batches can be rejected" }, { status: 400 });
      if (session.role !== "admin") return NextResponse.json({ error: "Only administrators can reject submissions" }, { status: 403 });

      newStatus = "draft";
      await db.prepare("UPDATE public.incentive_batches SET status = 'draft', rejection_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(rejection_reason || "Rejected by admin", batchId);

    } else if (action === "mark_paid") {
      // ACCOUNTS OR ADMIN
      if (oldStatus !== "approved") return NextResponse.json({ error: "Only approved batches status can be marked as paid" }, { status: 400 });
      if (!["accounts", "admin"].includes(session.role)) return NextResponse.json({ error: "Forbidden: Accounts privilege required" }, { status: 403 });

      newStatus = "paid";
      await db.prepare("UPDATE public.incentive_batches SET status = 'paid', paid_at = CURRENT_TIMESTAMP, paid_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(session.id, batchId);

      // Update Sales Logs to paid
      await db.prepare(`
        UPDATE public.sales_logs SET status = 'paid', updated_at = CURRENT_TIMESTAMP 
        WHERE id IN (SELECT sales_log_id FROM public.batch_items WHERE batch_id = ? AND sales_log_id IS NOT NULL)
      `).run(batchId);

      // Final Notifications
      const salespersons = await db.prepare("SELECT DISTINCT salesperson_id FROM public.batch_items WHERE batch_id = ?").all(batchId) as any[];
      for (const sp of salespersons) {
        await db.prepare("INSERT INTO public.notifications (user_id, title, message, type) VALUES (?, 'Payout Disbursed!', 'The finance team has processed your payment.', 'success')")
          .run(sp.salesperson_id);
      }

    } else {
      return NextResponse.json({ error: "Invalid workflow action" }, { status: 400 });
    }

    // Audit Recording
    await db.prepare(
      "INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_value, new_value) VALUES (?, ?, 'incentive_batch', ?, ?, ?)"
    ).run(session.id, action.toUpperCase(), batchId, JSON.stringify({ status: oldStatus }), JSON.stringify({ status: newStatus }));

    return NextResponse.json({ message: `Workflow transitioned to ${newStatus}`, status: newStatus });
  } catch (error: any) {
    console.error("[BATCH_PATCH_ERROR]", error.message);
    return NextResponse.json({ error: "Workflow transition failed: " + error.message }, { status: 500 });
  }
}
