import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import { sendBatchApprovedEmail, sendBatchPaidEmail, sendAdminBatchSubmissionNotification, sendAccountsBatchNotification } from "@/lib/email";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { action, rejection_reason, selectedItemIds } = body;

    const supabase = getSupabase();

    // 1. Fetch current batch state
    const { data: batch, error: bErr } = await supabase
      .from('incentive_batches')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (bErr || !batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

    // ── Optimistic locking: reject stale writes ───────────────
    const clientVersion = req.headers.get('X-Batch-Version');
    if (clientVersion !== null && batch.version !== undefined) {
      const cv = parseInt(clientVersion, 10);
      if (!isNaN(cv) && batch.version !== cv) {
        return NextResponse.json(
          { error: "Stale data — this batch was modified by someone else. Please refresh and try again.", code: "VERSION_CONFLICT" },
          { status: 409 }
        );
      }
    }

    const oldStatus = batch.status;
    let newStatus = oldStatus;
    const userRole = (session.role || "").toLowerCase();

    // 2. State Machine Logic
    if (action === "submit") {
      if (oldStatus !== "draft" && oldStatus !== "rejected") return NextResponse.json({ error: "Only draft batches can be submitted" }, { status: 400 });
      if (!["manager", "admin"].includes(userRole)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      newStatus = "pending_approval";
      await supabase.from('incentive_batches').update({
        status: newStatus,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', id);

      // Notification to Admin
      try {
        const { data: admins } = await supabase.from('users').select('email').eq('role_id', 1).eq('is_active', true);
        if (admins) {
          for (const admin of admins) {
            if (admin.email) {
              await sendAdminBatchSubmissionNotification(
                admin.email,
                session.full_name || "Manager",
                batch.batch_name,
                0, // itemCount placeholder
                batch.total_amount,
                batch.reference_number
              );
            }
          }
        }
      } catch (e) {
        console.warn("[BATCH_SUBMIT_NOTIFY] Error:", e);
      }

    } else if (action === "approve") {
      if (oldStatus !== "pending_approval") return NextResponse.json({ error: "Only pending batches can be approved" }, { status: 400 });
      if (userRole !== "admin") return NextResponse.json({ error: "Only administrators can grant final approval" }, { status: 403 });

      newStatus = "approved";
      await supabase.from('incentive_batches').update({
        status: newStatus,
        approved_at: new Date().toISOString(),
        approved_by: session.id,
        updated_at: new Date().toISOString()
      }).eq('id', id);

      // Notification Logic
      const { data: items } = await supabase.from('batch_items').select('salesperson_id, amount').eq('batch_id', id);
      if (items) {
        const salespersons = Array.from(new Set(items.map(i => i.salesperson_id)));
        for (const spId of salespersons) {
          const total = items.filter(i => i.salesperson_id === spId).reduce((s, i) => s + (i.amount || 0), 0);

          await supabase.from('notifications').insert({
            user_id: spId,
            title: 'Commission Approved!',
            message: `Your payment of ₹${total.toLocaleString()} has been approved and sent to Accounts.`,
            type: 'success'
          });

          const { data: user } = await supabase.from('users').select('email, full_name').eq('id', spId).single();
          if (user?.email) {
            try {
              await sendBatchApprovedEmail(user.email, user.full_name, batch.batch_name, total, batch.reference_number);
            } catch (e: any) {
              console.error(`[BATCH_NOTIFY] Failed to send approval email to ${user.email}:`, e.message);
            }
          }
        }
      }

      // Notify Accounts
      const { data: accounts } = await supabase.from('users').select('id, email, roles!inner(name)').eq('roles.name', 'accounts');
      if (accounts) {
        for (const acc of accounts) {
          await supabase.from('notifications').insert({
            user_id: acc.id,
            title: 'Pending Disbursement',
            message: `Batch "${batch.batch_name}" (₹${batch.total_amount.toLocaleString()}) requires final payment.`,
            type: 'info'
          });

          if (acc.email) {
            try {
              await sendAccountsBatchNotification(acc.email, batch.batch_name, batch.total_amount, session.full_name || "Administrator", batch.reference_number);
            } catch (e) {
              console.warn("[BATCH_APPROVE_FINANCE_NOTIFY] Error:", e);
            }
          }
        }
      }

    } else if (action === "reject") {
      if (oldStatus !== "pending_approval") return NextResponse.json({ error: "Only pending batches can be rejected" }, { status: 400 });
      if (userRole !== "admin") return NextResponse.json({ error: "Only administrators can reject submissions" }, { status: 403 });

      newStatus = "rejected";
      await supabase.from('incentive_batches').update({
        status: newStatus,
        rejection_reason: rejection_reason || "Rejected by admin",
        updated_at: new Date().toISOString()
      }).eq('id', id);

    } else if (action === "mark_paid") {
      if (oldStatus !== "approved") return NextResponse.json({ error: "Only approved batches can be marked as paid" }, { status: 400 });
      if (!["accounts", "admin"].includes(userRole)) return NextResponse.json({ error: "Forbidden: Accounts privilege required" }, { status: 403 });

      newStatus = "paid";
      await supabase.from('incentive_batches').update({
        status: newStatus,
        paid_at: new Date().toISOString(),
        paid_by: session.id,
        updated_at: new Date().toISOString()
      }).eq('id', id);

      // Update Statuses
      const { data: items } = await supabase.from('batch_items').select('sales_log_id, adjustment_id, salesperson_id, amount').eq('batch_id', id);
      if (items) {
        const logIds = items.filter(i => i.sales_log_id).map(i => i.sales_log_id);
        const adjIds = items.filter(i => i.adjustment_id).map(i => i.adjustment_id);

        if (logIds.length > 0) {
          await supabase.from('sales_logs').update({ status: 'paid', updated_at: new Date().toISOString() }).in('id', logIds);
        }

        if (adjIds.length > 0) {
          await supabase.from('adjustments').update({ status: 'applied', applied_at: new Date().toISOString() }).in('id', adjIds);
        }

        const salespersons = Array.from(new Set(items.map(i => i.salesperson_id)));
        for (const spId of salespersons) {
          const total = items.filter(i => i.salesperson_id === spId).reduce((s, i) => s + (i.amount || 0), 0);

          await supabase.from('notifications').insert({
            user_id: spId,
            title: 'Payout Disbursed!',
            message: 'The finance team has processed your payment.',
            type: 'success'
          });

          const { data: user } = await supabase.from('users').select('email, full_name').eq('id', spId).single();
          if (user?.email) {
            try {
              await sendBatchPaidEmail(user.email, user.full_name, batch.batch_name, total, batch.reference_number);
            } catch (e: any) {
              console.error(`[BATCH_NOTIFY] Failed to send payment email to ${user.email}:`, e.message);
            }
          }
        }
      }
    } else if (action === "pay_selected") {
      if (oldStatus !== "approved") return NextResponse.json({ error: "Only approved batches can be partially paid" }, { status: 400 });
      if (!["accounts", "admin"].includes(userRole)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (!selectedItemIds || !selectedItemIds.length) return NextResponse.json({ error: "No items selected" }, { status: 400 });

      // 1. Fetch selected items details
      const { data: items, error: iErr } = await supabase
        .from('batch_items')
        .select('*')
        .in('id', selectedItemIds)
        .eq('batch_id', id);

      if (iErr || !items?.length) return NextResponse.json({ error: "Items not found in this batch" }, { status: 404 });

      const subtotal = items.reduce((s, i) => s + (i.amount || 0), 0);
      const newBatchName = `Payout: ${batch.batch_name} (${items.length} items)`;

      // 2. Create New Paid Batch
      const { data: newBatch, error: nbErr } = await supabase
        .from('incentive_batches')
        .insert({
          batch_name: newBatchName,
          created_by: session.id,
          status: 'paid',
          total_amount: subtotal,
          paid_at: new Date().toISOString(),
          paid_by: session.id,
          period_start: batch.period_start,
          period_end: batch.period_end
        })
        .select('id')
        .single();

      if (nbErr) throw nbErr;

      // 3. Move items to the new batch
      await supabase
        .from('batch_items')
        .update({ batch_id: newBatch.id })
        .in('id', selectedItemIds);

      // 4. Update Statuses to paid
      const logIds = items.filter(i => i.sales_log_id).map(i => i.sales_log_id);
      const adjIds = items.filter(i => i.adjustment_id).map(i => i.adjustment_id);

      if (logIds.length > 0) {
        await supabase.from('sales_logs').update({ status: 'paid', updated_at: new Date().toISOString() }).in('id', logIds);
      }

      if (adjIds.length > 0) {
        await supabase.from('adjustments').update({ status: 'applied', applied_at: new Date().toISOString() }).in('id', adjIds);
      }

      // 5. Update parent batch amount
      const remainingAmount = Math.max(0, (batch.total_amount || 0) - subtotal);
      await supabase.from('incentive_batches').update({
        total_amount: remainingAmount,
        status: remainingAmount === 0 ? 'paid' : batch.status,
        paid_at: remainingAmount === 0 ? new Date().toISOString() : batch.paid_at,
        paid_by: remainingAmount === 0 ? session.id : batch.paid_by,
        updated_at: new Date().toISOString()
      }).eq('id', id);

      // 6. Notifications and Emails
      const salespersons = Array.from(new Set(items.map(i => i.salesperson_id)));
      for (const spId of salespersons) {
        const total = items.filter(i => i.salesperson_id === spId).reduce((s, i) => s + (i.amount || 0), 0);

        await supabase.from('notifications').insert({
          user_id: spId,
          title: 'Payout Disbursed!',
          message: `Your payment of ₹${total.toLocaleString()} from ${batch.batch_name} has been processed.`,
          type: 'success'
        });

        const { data: user } = await supabase.from('users').select('email, full_name').eq('id', spId).single();
        if (user?.email) {
          try {
            await sendBatchPaidEmail(user.email, user.full_name, newBatchName, total);
          } catch (e: any) {
            console.error(`[BATCH_NOTIFY] Failed to send partial payment email to ${user.email}:`, e.message);
          }
        }
      }

      newStatus = `paid_partial (created ${newBatch.id})`;
    }

    // 3. Audit
    await supabase.from('audit_logs').insert({
      user_id: session.id,
      action: action.toUpperCase(),
      entity_type: 'incentive_batch',
      entity_id: id,
      old_value: JSON.stringify({ status: oldStatus }),
      new_value: JSON.stringify({ status: newStatus })
    });

    return NextResponse.json({ message: `Workflow transitioned to ${newStatus}`, status: newStatus });

  } catch (error: any) {
    console.error("[BATCH_PATCH_ERROR]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || !["admin", "manager"].includes(session.role.toLowerCase())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const supabase = getSupabase();

    // 1. Fetch batch to verify status
    const { data: batch, error: bErr } = await supabase
      .from('incentive_batches')
      .select('status, batch_name, total_amount')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (bErr || !batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

    // Only allow deleting non-finalized batches
    if (["approved", "paid"].includes(batch.status)) {
      return NextResponse.json({ error: "Cannot delete an approved or paid batch." }, { status: 400 });
    }

    // 2. Revert associated items back to their pool
    const { data: batchItems } = await supabase
      .from('batch_items')
      .select('sales_log_id, adjustment_id')
      .eq('batch_id', id);

    if (batchItems) {
      const logIds = batchItems.filter(i => i.sales_log_id).map(i => i.sales_log_id);
      const adjIds = batchItems.filter(i => i.adjustment_id).map(i => i.adjustment_id);

      if (logIds.length > 0) {
        await supabase.from('sales_logs').update({ status: 'earned' }).in('id', logIds);
      }
      if (adjIds.length > 0) {
        await supabase.from('adjustments').update({ status: 'pending' }).in('id', adjIds);
      }
    }

    // 3. Soft delete — keep the record for audit trail, just mark it deleted
    const { error: delErr } = await supabase
      .from('incentive_batches')
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id);

    if (delErr) throw delErr;

    // 4. Audit
    await supabase.from('audit_logs').insert({
      user_id: session.id,
      action: 'DELETE',
      entity_type: 'incentive_batch',
      entity_id: id,
      old_value: JSON.stringify({ status: batch.status, name: batch.batch_name, total: batch.total_amount })
    });

    return NextResponse.json({ message: "Batch deleted and items returned to pool" });
  } catch (error: any) {
    console.error("[BATCH_DELETE_ERROR]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
