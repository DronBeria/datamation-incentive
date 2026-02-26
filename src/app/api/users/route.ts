import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { sendUserStatusUpdate, sendWelcomeEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabase();
    const userRole = (session.role || "").toLowerCase().trim();

    let { data: users, error } = await supabase
      .from('users')
      .select(`
        id, email, full_name, department, is_active, approval_status, created_at, manager_id, role_id,
        role:roles(name),
        scheme_assignments:user_scheme_assignments(
          scheme_id,
          scheme:incentive_schemes(name),
          end_date
        ),
        manager:users!manager_id(full_name)
      `)
      .order('id', { ascending: false });

    if (error) throw error;

    let filtered = users || [];
    if (userRole === 'manager') {
      filtered = filtered.filter(u => u.manager_id == session.id || u.id == session.id);
    }

    const result = filtered.map((u: any) => {
      const activeAssignment = u.scheme_assignments?.find((sa: any) => !sa.end_date);
      return {
        ...u,
        role: u.role?.name || 'unknown',
        role_id: u.role_id,
        scheme_id: activeAssignment?.scheme_id || null,
        scheme_name: activeAssignment?.scheme?.name || null,
        manager_name: u.manager?.full_name || null
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[USERS_API_GET]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || !["admin", "manager"].includes(session.role.toLowerCase())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { email, password, full_name, role_id, department, manager_id, scheme_id } = body;

    const supabase = getSupabase();
    const hash = bcrypt.hashSync(password, 10);

    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        email,
        password_hash: hash,
        full_name,
        role_id: parseInt(role_id),
        department: department || "",
        manager_id: (manager_id === "none" || !manager_id) ? null : parseInt(manager_id),
        approval_status: body.approval_status || 'approved'
      })
      .select('id')
      .single();

    if (createError) throw createError;

    if (scheme_id && scheme_id !== 'none' && parseInt(role_id) === 4) {
      await supabase.from('user_scheme_assignments').insert({
        user_id: newUser.id,
        scheme_id: parseInt(scheme_id),
        start_date: new Date().toISOString().split('T')[0]
      });
    }

    try { await sendWelcomeEmail(email, full_name, password); } catch (e) { }

    return NextResponse.json({ id: newUser.id, message: "User indexed" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session || !["admin", "manager", "accounts"].includes(session.role.toLowerCase())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { id, email, full_name, role_id, department, is_active, approval_status, scheme_id, manager_id } = body;

    const supabase = getSupabase();
    const parsedRoleId = parseInt(role_id);
    const status = approval_status || 'approved';

    // 1. Mandatory Scheme Check for Salespeople
    if (status === 'approved' && parsedRoleId === 4) {
      const { data: active } = await supabase
        .from('user_scheme_assignments')
        .select('id')
        .eq('user_id', id)
        .is('end_date', null);

      const hasDB = active && active.length > 0;
      const willAssign = scheme_id && scheme_id !== 'none';

      if (!hasDB && !willAssign) {
        return NextResponse.json({
          error: "Salesperson must be assigned to a scheme before approval. Please select a scheme in the profile editor."
        }, { status: 400 });
      }
    }

    // 2. Update User
    const updateData: any = {
      email, full_name, department,
      role_id: parsedRoleId,
      is_active: !!is_active,
      approval_status: status,
      manager_id: (manager_id === "none" || !manager_id) ? null : parseInt(manager_id)
    };
    if (body.password) updateData.password_hash = bcrypt.hashSync(body.password, 10);

    const { error: uErr } = await supabase.from('users').update(updateData).eq('id', id);
    if (uErr) throw uErr;

    // 3. Update Scheme Assignment
    if (parsedRoleId === 4 && body.hasOwnProperty('scheme_id')) {
      const { data: current } = await supabase
        .from('user_scheme_assignments')
        .select('scheme_id')
        .eq('user_id', id)
        .is('end_date', null)
        .single();

      const newSchemeId = (scheme_id && scheme_id !== 'none') ? parseInt(scheme_id) : null;

      if (current?.scheme_id !== newSchemeId) {
        // End old
        await supabase.from('user_scheme_assignments').update({ end_date: new Date().toISOString().split('T')[0] }).eq('user_id', id).is('end_date', null);
        // Start new
        if (newSchemeId) {
          await supabase.from('user_scheme_assignments').insert({
            user_id: id,
            scheme_id: newSchemeId,
            start_date: new Date().toISOString().split('T')[0]
          });
        }
      }
    }

    if (approval_status && approval_status !== "pending") {
      try { await sendUserStatusUpdate(email, full_name, status === 'approved' ? 'approved' : 'rejected'); } catch (e) { }
    }

    return NextResponse.json({ message: "Updated successfully" });
  } catch (error: any) {
    console.error('[USERS_PUT_ERROR]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role.toLowerCase() !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const supabase = getSupabase();

    if (searchParams.get("purge") === "true") {
      // Safety Guard: Masters cannot be purged
      if (id === "1") return NextResponse.json({ error: "Master account is protected and cannot be purged." }, { status: 403 });

      // Robust Purge Sequence
      // 1. Assignments
      await supabase.from('user_scheme_assignments').delete().eq('user_id', id);

      // 2. Notifications & Adjustments
      await supabase.from('notifications').delete().eq('user_id', id);
      await supabase.from('adjustments').delete().eq('salesperson_id', id);

      // 3. Sales Logs & Batch Items
      // We must delete batch items first because they reference sales logs
      await supabase.from('batch_items').delete().eq('salesperson_id', id);
      await supabase.from('sales_logs').delete().eq('salesperson_id', id);

      // 4. Batch References (Management Roles)
      // Set to null instead of deleting the whole batch for auditing history
      // Note: created_by is NOT NULL, so we reassign to the master admin (ID: 1)
      await supabase.from('incentive_batches').update({ created_by: 1 }).eq('created_by', id);
      await supabase.from('incentive_batches').update({ approved_by: null }).eq('approved_by', id);
      await supabase.from('incentive_batches').update({ paid_by: null }).eq('paid_by', id);

      // 5. Manager References
      await supabase.from('users').update({ manager_id: null }).eq('manager_id', id);

      // 6. Audit logs cleanup
      await supabase.from('audit_logs').delete().eq('entity_id', id).eq('entity_type', 'user');
      await supabase.from('audit_logs').delete().eq('user_id', id);

      // 7. Final User Deletion
      const { error: delErr } = await supabase.from('users').delete().eq('id', id);
      if (delErr) throw delErr;
    } else {
      await supabase.from('users').update({ is_active: false }).eq('id', id);
    }

    return NextResponse.json({ message: "Deleted" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
