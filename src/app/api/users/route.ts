import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendUserStatusUpdate, sendWelcomeEmail } from "@/lib/email";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session || !["admin", "manager"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let query = `
    SELECT 
      u.id, u.email, u.full_name, u.department, u.is_active, u.approval_status, u.created_at, u.manager_id,
      r.name as role,
      sch.name as scheme_name,
      m.full_name as manager_name
    FROM users u 
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN users m ON u.manager_id = m.id
    LEFT JOIN user_scheme_assignments usa ON u.id = usa.user_id AND (usa.end_date IS NULL OR usa.end_date >= CURRENT_DATE)
    LEFT JOIN incentive_schemes sch ON usa.scheme_id = sch.id
  `;

  const params: any[] = [];
  if (session.role === "manager") {
    query += " WHERE u.manager_id = ? OR u.id = ?";
    params.push(session.id, session.id);
  }

  query += " ORDER BY u.id";

  try {
    const users = await db.prepare(query).all(...params);
    return NextResponse.json(users);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !["admin", "manager"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { email, password, full_name, role_id, department } = body;

  if (!email || !password || !full_name || !role_id) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Managers can ONLY create Salespeople (role_id 4)
  if (session.role === "manager" && parseInt(role_id) !== 4) {
    return NextResponse.json({ error: "Managers can only register Salespeople" }, { status: 403 });
  }

  const existing = await db.prepare("SELECT id FROM public.users WHERE email = ?").get(email);
  if (existing) {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }

  const hash = bcrypt.hashSync(password, 10);
  let managerId = (body.manager_id === "none" || !body.manager_id) ? (session.role === "manager" ? session.id : null) : body.manager_id;

  const result = await db.prepare(
    "INSERT INTO public.users (email, password_hash, full_name, role_id, department, manager_id) VALUES (?, ?, ?, ?, ?, ?) RETURNING id"
  ).run(email, hash, full_name, role_id, department || "", managerId);

  const userId = result.lastInsertRowid;

  // If a scheme was selected, assign it
  const { scheme_id } = body;
  if (scheme_id && scheme_id !== 'none' && parseInt(role_id) === 4) {
    await db.prepare(
      "INSERT INTO public.user_scheme_assignments (user_id, scheme_id, start_date) VALUES (?, ?, CURRENT_DATE)"
    ).run(userId, scheme_id);
  }

  // 4. Send Welcome Email (Non-blocking)
  try {
    await sendWelcomeEmail(email, full_name, password);
  } catch (e) {
    console.warn("Welcome email deferred:", e);
  }

  return NextResponse.json({ id: userId, message: "Team member successfully indexed" });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session || !["admin", "manager"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { id, email, password, full_name, role_id, department, is_active, approval_status } = body;

  if (!id) return NextResponse.json({ error: "User ID required" }, { status: 400 });

  // 0. Check for email conflict
  const conflict = await db.prepare("SELECT id FROM public.users WHERE email = ? AND id != ?").get(email, id);
  if (conflict) {
    return NextResponse.json({ error: "Email already taken by another account" }, { status: 409 });
  }

  // Security Check: If manager, verify they manage this user
  if (session.role === "manager") {
    const userToEdit = await db.prepare("SELECT manager_id FROM public.users WHERE id = ?").get(id) as any;
    if (!userToEdit || (userToEdit.manager_id !== session.id && id !== session.id)) {
      return NextResponse.json({ error: "Unauthorized: You can only edit your own team members" }, { status: 403 });
    }
    // Managers cannot change roles of others (except for creating salespeople)
    if (id !== session.id && parseInt(role_id) !== 4) {
      return NextResponse.json({ error: "Managers can only manage Salespeople" }, { status: 403 });
    }
  }

  // 1. Update basic info
  let managerId = (body.manager_id === "none" || !body.manager_id) ? null : body.manager_id;
  if (session.role === "manager" && id !== session.id) {
    managerId = session.id;
  }

  const status = approval_status || 'approved';

  // NEW: Mandatory Scheme Check for Salesperson Approval
  if (status === 'approved' && parseInt(role_id) === 4) {
    const activeAssignment = await db.prepare(
      "SELECT id FROM public.user_scheme_assignments WHERE user_id = ? AND end_date IS NULL"
    ).get(id);

    // Check if a scheme is either already assigned OR being assigned in this request
    const beingAssigned = body.scheme_id && body.scheme_id !== 'none';

    if (!activeAssignment && !beingAssigned) {
      return NextResponse.json({
        error: "Validation Failed: Salesperson must be assigned to an incentive scheme before approval."
      }, { status: 400 });
    }
  }

  let sql = "UPDATE public.users SET email = ?, full_name = ?, role_id = ?, department = ?, is_active = ?, manager_id = ?, approval_status = ? WHERE id = ?";
  let params = [email, full_name, role_id, department, is_active, managerId, status, id];

  await db.prepare(sql).run(...params);

  // 2. Optional Password Update
  if (password && password.trim() !== "") {
    const hash = bcrypt.hashSync(password, 10);
    await db.prepare("UPDATE public.users SET password_hash = ? WHERE id = ?").run(hash, id);
  }

  // 3. Scheme Update for Salespeople
  const { scheme_id } = body;
  if (parseInt(role_id) === 4) {
    // Only update if scheme_id is explicitly passed in the update
    if (body.hasOwnProperty('scheme_id')) {
      // End current assignment
      await db.prepare("UPDATE public.user_scheme_assignments SET end_date = CURRENT_DATE WHERE user_id = ? AND end_date IS NULL").run(id);
      if (scheme_id && scheme_id !== 'none') {
        await db.prepare("INSERT INTO public.user_scheme_assignments (user_id, scheme_id, start_date) VALUES (?, ?, CURRENT_DATE)").run(id, scheme_id);
      }
    }
  }

  await db.prepare(
    "INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_value) VALUES (?, 'UPDATE', 'user', ?, ?)"
  ).run(session.id, id, JSON.stringify({ email, role_id, is_active, approval_status: status }));

  // 4. Send Notification if approval status changed
  if (approval_status && approval_status !== "pending") {
    try {
      await sendUserStatusUpdate(email, full_name, approval_status === 'approved' ? 'approved' : 'rejected');
    } catch (e) {
      console.warn("User status email deferred:", e);
    }
  }

  return NextResponse.json({ message: "Profile updated successfully" });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session || !["admin", "manager"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "User ID required" }, { status: 400 });

  // Safeguard: Don't delete self
  if (id === session.id) return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });

  // Security Check: If manager, verify they manage this user
  if (session.role === "manager") {
    const userToEdit = await db.prepare("SELECT manager_id FROM public.users WHERE id = ?").get(id) as any;
    if (!userToEdit || userToEdit.manager_id !== session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  }

  const purgeRequested = searchParams.get("purge") === "true";

  try {
    // 🛡️ Industrial Safety Check: Only purge if explicitly requested AND caller is Admin
    if (purgeRequested && session.role === 'admin') {
      await db.prepare("DELETE FROM public.user_scheme_assignments WHERE user_id = ?").run(id);
      await db.prepare("DELETE FROM public.audit_logs WHERE (user_id = ? OR (entity_type = 'user' AND entity_id = ?))").run(id, id);
      await db.prepare("DELETE FROM public.users WHERE id = ?").run(id);

      await db.prepare(
        "INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_value) VALUES (?, 'PURGE', 'user', ?, ?)"
      ).run(session.id, id, JSON.stringify({ reason: "Manual data purge" }));

      return NextResponse.json({ message: "User record and associated metadata permanently purged", type: 'purged' });
    }

    // 🏭 Default Workflow: Deactivation (Soft-Delete)
    await db.prepare("UPDATE public.users SET is_active = FALSE WHERE id = ?").run(id);

    // Close active scheme assignments
    await db.prepare("UPDATE public.user_scheme_assignments SET end_date = CURRENT_DATE WHERE user_id = ? AND end_date IS NULL").run(id);

    await db.prepare(
      "INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_value) VALUES (?, 'SUSPEND', 'user', ?, ?)"
    ).run(session.id, id, JSON.stringify({ status: 'inactive' }));

    return NextResponse.json({
      message: "User access restricted (Audit history preserved)",
      type: 'deactivated'
    });
  } catch (err: any) {
    console.error("[USER_DELETE_ERROR]", err.message);
    return NextResponse.json({ error: "Operation restricted due to data relations" }, { status: 500 });
  }
}
