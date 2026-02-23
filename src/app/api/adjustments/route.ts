import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendIncentiveUpdate } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");

    let query = `
        SELECT a.*, u.full_name 
        FROM public.adjustments a 
        JOIN public.users u ON a.salesperson_id = u.id
    `;
    const params: any[] = [];

    if (session.role === "salesperson") {
        query += " WHERE a.salesperson_id = ?";
        params.push(session.id);
    } else if (userId) {
        query += " WHERE a.salesperson_id = ?";
        params.push(userId);
    }

    query += " ORDER BY a.created_at DESC";

    try {
        const rows = await db.prepare(query).all(...params);
        return NextResponse.json(rows);
    } catch (err: any) {
        console.error("[ADJUSTMENTS_GET_ERROR]", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session || !["admin", "manager", "accounts"].includes(session.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { user_id, amount, reason, type } = body;

    if (!user_id || amount === undefined || !reason || !type) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    try {
        const result = await db.prepare(`
          INSERT INTO adjustments (salesperson_id, amount, reason, type, status)
          VALUES (?, ?, ?, ?, 'pending')
          RETURNING id
        `).run(user_id, amount, reason, type);

        await db.prepare(
            "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value) VALUES (?, 'CREATE', 'adjustment', ?, ?)"
        ).run(session.id, result.lastInsertRowid, JSON.stringify(body));

        // Email notification (non-blocking)
        try {
            const staff = await db.prepare("SELECT email, full_name FROM public.users WHERE id = ?").get(user_id) as any;
            if (staff?.email) {
                const displayAction = type === 'bonus' ? 'A performance bonus has been applied to your account' : 'A manual adjustment has been applied to your account';
                await sendIncentiveUpdate(staff.email, staff.full_name, displayAction, parseFloat(amount));
            }
        } catch (e) {
            console.warn("[ADJUSTMENTS] Email notification deferred:", e);
        }

        return NextResponse.json({ id: result.lastInsertRowid, message: "Adjustment successfully recorded" });
    } catch (err: any) {
        console.error("[ADJUSTMENT_POST_ERROR]", err.message);
        return NextResponse.json({ error: err.message }, { status: 400 });
    }
}
