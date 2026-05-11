import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  const currentToken = req.cookies.get("token")?.value;
  const currentHash = currentToken ? hashToken(currentToken) : null;

  const { data, error } = await supabase
    .from("user_sessions")
    .select("id, ip_address, user_agent, last_active, created_at, token_hash")
    .eq("user_id", session.id)
    .is("revoked_at", null)
    .order("last_active", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sessions = (data || []).map(s => ({
    id: s.id,
    ip_address: s.ip_address,
    user_agent: s.user_agent,
    last_active: s.last_active,
    created_at: s.created_at,
    is_current: currentHash ? s.token_hash === currentHash : false,
  }));

  // Move current session to top
  return NextResponse.json(sessions.sort((a, b) => (b.is_current ? 1 : 0) - (a.is_current ? 1 : 0)));
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { session_id, revoke_all } = body;

  const supabase = getSupabase();
  const currentToken = req.cookies.get("token")?.value;
  const currentHash = currentToken ? hashToken(currentToken) : null;

  if (revoke_all) {
    // Revoke all sessions EXCEPT the current one
    let q = supabase
      .from("user_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", session.id)
      .is("revoked_at", null);

    if (currentHash) q = q.neq("token_hash", currentHash);
    const { error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: "All other sessions revoked" });
  }

  if (session_id) {
    // Verify ownership before revoking
    const { data: s } = await supabase.from("user_sessions").select("user_id").eq("id", session_id).single();
    if (!s || s.user_id !== session.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { error } = await supabase
      .from("user_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", session_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: "Session revoked" });
  }

  return NextResponse.json({ error: "Provide session_id or revoke_all" }, { status: 400 });
}
