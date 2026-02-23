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
    console.log(`[USERS_API] DEBUG: Email=${session.email} | Role=${userRole} | ID=${session.id}`);

    // 1. Primary Fetch
    let { data: users, error } = await supabase
      .from('users')
      .select(`
        id, email, full_name, department, is_active, approval_status, created_at, manager_id,
        role:roles(name),
        scheme_assignments:user_scheme_assignments(
          scheme:incentive_schemes(name)
        ),
        manager:users!manager_id(full_name)
      `)
      .order('id', { ascending: false });

    if (error) throw error;

    // 2. Emergency Fallback: If 0 rows and user is Admin, try an unfiltered direct fetch
    if ((!users || users.length === 0) && userRole === 'admin') {
      console.warn("[USERS_API] Admin saw 0 users! Running emergency fallback fetch...");
      const { data: fallback } = await supabase.from('users').select('id, full_name, role_id').limit(10);
      if (fallback && fallback.length > 0) {
        console.log(`[USERS_API] Fallback found ${fallback.length} users. This confirms a JOIN or Filter failure.`);
        // Note: We return the primary fetch result still, but this log tells us it's a code logic issue
      }
    }

    // 3. Application-Level Filtering (Safer than query builder for debugging)
    let filtered = users || [];
    if (userRole === 'manager') {
      filtered = filtered.filter(u => u.manager_id == session.id || u.id == session.id);
      console.log(`[USERS_API] Manager ${session.id} filtered down to ${filtered.length} team members`);
    }

    // 4. Flatten for Frontend
    const result = filtered.map((u: any) => ({
      ...u,
      role: u.role?.name || 'unknown',
      scheme_name: u.scheme_assignments?.find((sa: any) => !sa.end_date)?.scheme?.name || null,
      manager_name: u.manager?.full_name || null
    }));

    return new NextResponse(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      },
    });
  } catch (error: any) {
    console.error('[USERS_API] Pipeline Failure:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
