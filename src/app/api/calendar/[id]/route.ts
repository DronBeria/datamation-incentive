import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || !["admin", "manager"].includes(session.role))
      return NextResponse.json({ error: "Only admins and managers can edit events" }, { status: 403 });
    const { id } = await params;
    const { title, description, event_date, start_time, end_time, type, attendees } = await req.json();
    if (!title || !event_date) return NextResponse.json({ error: "Title and date are required" }, { status: 400 });
    const supabase = getSupabase();
    const { error } = await supabase.from("calendar_events").update({ title: title.trim(), description: description || null, event_date, start_time: start_time || null, end_time: end_time || null, type: type || "meeting", attendees: attendees || null, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    await supabase.from("audit_logs").insert({ user_id: session.id, action: "UPDATE", entity_type: "calendar_event", entity_id: parseInt(id), new_value: JSON.stringify({ title, event_date, type }) });
    return NextResponse.json({ message: "Event updated" });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || !["admin", "manager"].includes(session.role))
      return NextResponse.json({ error: "Only admins and managers can delete events" }, { status: 403 });
    const { id } = await params;
    const supabase = getSupabase();
    const { error } = await supabase.from("calendar_events").delete().eq("id", id);
    if (error) throw error;
    await supabase.from("audit_logs").insert({ user_id: session.id, action: "DELETE", entity_type: "calendar_event", entity_id: parseInt(id) });
    return NextResponse.json({ message: "Event deleted" });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
