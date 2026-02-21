import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const dateFrom = url.searchParams.get("from");
  const dateTo = url.searchParams.get("to");

  const conditions: string[] = [];
  const params: any[] = [];

  if (dateFrom) {
    conditions.push("date(al.created_at) >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push("date(al.created_at) <= ?");
    params.push(dateTo);
  }

  const where = conditions.length ? " WHERE " + conditions.join(" AND ") : "";

  const db = getDb();
  const logs = await db.prepare(`
    SELECT al.*, u.full_name 
    FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id 
    ${where}
    ORDER BY al.created_at DESC LIMIT 200
  `).all(...params);

  return NextResponse.json(logs);
}
