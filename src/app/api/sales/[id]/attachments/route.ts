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

const BUCKET = "sale-attachments";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("sale_attachments")
    .select("*")
    .eq("sales_log_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabase();

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_SIZE) return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 400 });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${id}/${Date.now()}-${safeName}`;

    // Upload to Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, { contentType: file.type, upsert: false });

    if (uploadErr) throw uploadErr;

    // Get public URL
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    // Record in DB
    const { data: attachment, error: dbErr } = await supabase
      .from("sale_attachments")
      .insert({
        sales_log_id: parseInt(id),
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        uploaded_by: session.id,
      })
      .select("id, file_name, file_url, file_size, created_at")
      .single();

    if (dbErr) throw dbErr;

    await supabase.from("audit_logs").insert({
      user_id: session.id,
      action: "UPLOAD",
      entity_type: "sale_attachment",
      entity_id: attachment.id,
      new_value: JSON.stringify({ file_name: file.name, sales_log_id: id }),
    });

    return NextResponse.json(attachment);
  } catch (err: any) {
    console.error("[ATTACHMENT_POST_ERROR]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const url = new URL(req.url);
  const attachmentId = url.searchParams.get("attachment_id");

  if (!attachmentId) return NextResponse.json({ error: "attachment_id required" }, { status: 400 });

  const supabase = getSupabase();

  const { data: att } = await supabase
    .from("sale_attachments")
    .select("file_url, uploaded_by")
    .eq("id", attachmentId)
    .eq("sales_log_id", id)
    .single();

  if (!att) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

  // Only uploader or admin/manager can delete
  const role = (session.role || "").toLowerCase();
  if (att.uploaded_by !== session.id && !["admin", "manager"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Delete from storage
  const storagePath = att.file_url.split(`/${BUCKET}/`)[1];
  if (storagePath) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
  }

  await supabase.from("sale_attachments").delete().eq("id", attachmentId);

  return NextResponse.json({ message: "Attachment deleted" });
}
