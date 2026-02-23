import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      console.error("[USERS_API] No session found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const userRole = (session.role || "").toLowerCase().trim();
    console.log(`[USERS_API] Active: ${session.email} | Role: ${userRole} | ID: ${session.id}`);

    // Direct fetch using Supabase SDK to eliminate all middleware/RPC variables
    let query = supabase
      .from('users')
      .select(`
        id, email, full_name, department, is_active, approval_status, created_at, manager_id,
        role:roles(name),
        scheme_assignments:user_scheme_assignments(
          scheme:incentive_schemes(name)
        ),
        manager:users!manager_id(full_name)
      `);

    // Only apply manager filter if strictly a manager
    if (userRole === 'manager') {
      query = query.or(`manager_id.eq.${session.id},id.eq.${session.id}`);
    }

    query = query.order('id', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('[USERS_API] Supabase Fetch Error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Flatten to match the dashboard's expected data structure
    const users = (data || []).map((u: any) => ({
      ...u,
      role: u.role?.name || 'unknown',
      scheme_name: u.scheme_assignments?.find((sa: any) => !sa.end_date)?.scheme?.name || null,
      manager_name: u.manager?.full_name || null
    }));

    console.log(`[USERS_API] Returning ${users.length} members`);

    return new NextResponse(JSON.stringify(users), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error('[USERS_API] Crash:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
