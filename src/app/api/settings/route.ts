import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

const KNOWN_KEYS = ["tds_enabled", "tds_rate", "tds_threshold_yearly"] as const;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.role || "").toLowerCase();
  if (!["admin", "manager"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.from("system_settings").select("key, value");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const map = Object.fromEntries((data || []).map(r => [r.key, r.value]));

  return NextResponse.json({
    tds_enabled: map.tds_enabled === "true",
    tds_rate: parseFloat(map.tds_rate || "10"),
    tds_threshold_yearly: parseFloat(map.tds_threshold_yearly || "30000"),
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if ((session.role || "").toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Only administrators can modify system settings" }, { status: 403 });
  }

  const body = await req.json();
  const { key, value } = body;

  if (!KNOWN_KEYS.includes(key as any)) {
    return NextResponse.json({ error: "Unknown setting key" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("system_settings")
    .upsert({ key, value: String(value), updated_by: session.id, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit
  await supabase.from("audit_logs").insert({
    user_id: session.id,
    action: "UPDATE",
    entity_type: "system_setting",
    entity_id: key,
    new_value: JSON.stringify({ key, value }),
  });

  return NextResponse.json({ message: "Setting saved" });
}
