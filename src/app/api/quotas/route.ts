import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const session = await getSession();
    if (!session || !["admin", "manager"].includes(session.role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const month = url.searchParams.get("month") || new Date().getMonth() + 1;
    const year = url.searchParams.get("year") || new Date().getFullYear();

    const db = getDb();
    const quotas = await db.prepare(`
    SELECT q.*, u.full_name, u.email 
    FROM quotas q 
    JOIN users u ON q.user_id = u.id 
    WHERE q.period_month=? AND q.period_year=?
  `).all(month, year);

    return NextResponse.json(quotas);
}

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { user_id, target_amount, month, year } = body;

    if (!user_id || !target_amount) {
        return NextResponse.json({ error: "User ID and target amount are required" }, { status: 400 });
    }

    const db = getDb();
    try {
        const result = await db.prepare(`
      INSERT INTO quotas (user_id, target_amount, period_month, period_year)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, period_month, period_year) DO UPDATE SET
        target_amount = excluded.target_amount
    `).run(user_id, target_amount, month || new Date().getMonth() + 1, year || new Date().getFullYear());

        return NextResponse.json({ message: "Quota updated" });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
    }
}
