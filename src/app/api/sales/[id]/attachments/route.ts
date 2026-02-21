import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const db = getDb();

    const attachments = await db.prepare("SELECT * FROM attachments WHERE sales_log_id = ?").all(id);
    return NextResponse.json(attachments);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { file_name, file_size } = body;

    const db = getDb();
    try {
        const result = await db.prepare(`
      INSERT INTO attachments (sales_log_id, file_name, file_path, file_size)
      VALUES (?, ?, ?, ?)
    `).run(id, file_name, `/uploads/${file_name}`, file_size || 0);

        return NextResponse.json({ id: result.lastInsertRowid, message: "Attachment record created" });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
    }
}
