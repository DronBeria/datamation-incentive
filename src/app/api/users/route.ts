import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.role || "").toLowerCase();

    // 1. Build a robust query with LEFT JOINs to prevent disappearing rows
    let query = `
      SELECT 
        u.id, u.email, u.full_name, u.department, u.is_active, u.approval_status, u.created_at, u.manager_id,
        COALESCE(r.name, 'unknown') as role,
        sch.name as scheme_name,
        m.full_name as manager_name
      FROM public.users u 
      LEFT JOIN public.roles r ON u.role_id = r.id
      LEFT JOIN public.users m ON u.manager_id = m.id
      LEFT JOIN public.user_scheme_assignments usa ON u.id = usa.user_id AND (usa.end_date IS NULL OR usa.end_date >= CURRENT_DATE)
      LEFT JOIN public.incentive_schemes sch ON usa.scheme_id = sch.id
    `;

    const params: any[] = [];

    // 2. ONLY filter if the user is strictly a manager. Admins/Accounts see all.
    if (role === "manager") {
      query += " WHERE u.manager_id = ? OR u.id = ?";
      params.push(session.id, session.id);
    }

    query += " ORDER BY u.id DESC";

    const users = await db.prepare(query).all(...params);

    console.log(`[USERS_API] Session: ${session.email} | Role: ${role} | Found: ${users.length}`);

    // Return with headers to prevent any caching
    return new NextResponse(JSON.stringify(users), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error('[USERS_API] Critical Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
