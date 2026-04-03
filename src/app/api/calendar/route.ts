import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function ensureTable(supabase: ReturnType<typeof getSupabase>) {
  // 1. Create table if missing
  await supabase.rpc("exec_sql", {
    sql_query: `
      CREATE TABLE IF NOT EXISTS public.calendar_events (
        id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        title TEXT NOT NULL,
        description TEXT,
        event_date DATE NOT NULL,
        start_time TEXT,
        end_time TEXT,
        type TEXT DEFAULT 'meeting' CHECK(type IN ('meeting', 'review', 'deadline', 'training', 'other')),
        attendees TEXT,
        created_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
        created_by_name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
  });

  // 2. Ensure all columns exist (in case of partial migration)
  const columns = [
    { name: "event_date", type: "DATE NOT NULL DEFAULT CURRENT_DATE" },
    { name: "start_time", type: "TEXT" },
    { name: "end_time", type: "TEXT" },
    { name: "type", type: "TEXT DEFAULT 'meeting'" },
    { name: "attendees", type: "TEXT" },
    { name: "created_by", type: "BIGINT REFERENCES public.users(id)" },
    { name: "created_by_name", type: "TEXT" }
  ];

  for (const col of columns) {
    await supabase.rpc("exec_sql", {
      sql_query: `ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};`
    });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabase();
    await ensureTable(supabase);

    const url = new URL(req.url);
    const month = url.searchParams.get("month"); // YYYY-MM
    const year = url.searchParams.get("year");

    let query = supabase
      .from("calendar_events")
      .select("*")
      .order("event_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (month) {
      const [y, m] = month.split("-");
      const startDate = `${y}-${m}-01`;
      const endDay = new Date(parseInt(y), parseInt(m), 0).getDate();
      const endDate = `${y}-${m}-${String(endDay).padStart(2, "0")}`;
      query = query.gte("event_date", startDate).lte("event_date", endDate);
    } else if (year) {
      query = query.gte("event_date", `${year}-01-01`).lte("event_date", `${year}-12-31`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("[CALENDAR_GET_ERROR]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !["admin", "manager"].includes(session.role)) {
      return NextResponse.json({ error: "Only admins and managers can create events" }, { status: 403 });
    }

    const body = await req.json();
    const { title, description, event_date, start_time, end_time, type, attendees } = body;

    if (!title || !event_date) {
      return NextResponse.json({ error: "Title and date are required" }, { status: 400 });
    }

    const supabase = getSupabase();
    await ensureTable(supabase);

    const { data, error } = await supabase
      .from("calendar_events")
      .insert({
        title: title.trim(),
        description: description || null,
        event_date,
        start_time: start_time || null,
        end_time: end_time || null,
        type: type || "meeting",
        attendees: attendees || null,
        created_by: session.id,
        created_by_name: session.full_name || "Unknown",
      })
      .select("id")
      .single();

    if (error) throw error;

    await supabase.from("audit_logs").insert({
      user_id: session.id,
      action: "CREATE",
      entity_type: "calendar_event",
      entity_id: data.id,
      new_value: JSON.stringify({ title, event_date, type }),
    });

    return NextResponse.json({ id: data.id, message: "Event created" });
  } catch (error: any) {
    console.error("[CALENDAR_POST_ERROR]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
