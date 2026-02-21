import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
    const session = await getSession();
    if (!session || !["admin", "manager"].includes(session.role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const schemes = await db.prepare("SELECT * FROM incentive_schemes ORDER BY name ASC").all();
    return NextResponse.json(schemes);
}

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session || !["admin", "manager"].includes(session.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, calculation_type, base_rate, target_threshold, bonus_rate } = body;

    if (!name || !calculation_type) {
        return NextResponse.json({ error: "Name and calculation type are required" }, { status: 400 });
    }

    try {
        const result = await db.prepare(`
          INSERT INTO incentive_schemes 
          (name, description, calculation_type, base_rate, target_threshold, bonus_rate)
          VALUES (?, ?, ?, ?, ?, ?)
          RETURNING id
        `).run(
            name,
            description || "",
            calculation_type,
            base_rate || 0,
            target_threshold || 0,
            bonus_rate || 0
        );

        await db.prepare(
            "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value) VALUES (?, 'CREATE', 'incentive_scheme', ?, ?)"
        ).run(session.id, result.lastInsertRowid, JSON.stringify(body));

        return NextResponse.json({ id: result.lastInsertRowid, message: "Commission scheme blueprint successfully indexed" });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
    }
}
