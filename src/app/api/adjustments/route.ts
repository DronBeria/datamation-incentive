import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const salespersonId = url.searchParams.get("userId");

    const db = getDb();
    let query = "SELECT a.*, u.full_name FROM adjustments a JOIN users u ON a.salesperson_id = u.id";
    const params = [];

    if (session.role === "salesperson") {
        query += " WHERE a.salesperson_id = ?";
        params.push(session.id);
    } else if (salespersonId) {
        query += " WHERE a.salesperson_id = ?";
        params.push(salespersonId);
    }

    query += " ORDER BY a.created_at DESC";
    const rows = await db.prepare(query).all(...params);
    return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session || !["admin", "manager"].includes(session.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { salesperson_id, amount, reason, type } = body;

    if (!salesperson_id || amount === undefined || !reason || !type) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = getDb();
    try {
        const result = await db.prepare(`
      INSERT INTO adjustments (salesperson_id, amount, reason, type, status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(salesperson_id, amount, reason, type);

        await db.prepare(
            "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value) VALUES (?, 'CREATE', 'adjustment', ?, ?)"
        ).run(session.id, result.lastInsertRowid, JSON.stringify(body));

        return NextResponse.json({ id: result.lastInsertRowid, message: "Fiscal adjustment successfully indexed" });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
    }
}
