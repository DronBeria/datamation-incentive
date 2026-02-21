import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        const { email } = await req.json();

        const user = await db.prepare("SELECT id FROM users WHERE email = ? AND is_active = TRUE").get(email);

        if (!user) {
            // For security, don't reveal if user exists
            return NextResponse.json({ message: "If an account exists, a reset link will be sent." });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hour

        await db.prepare("UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?")
            .run(token, expires.toISOString(), user.id);

        // In a real industrial app, you would send an email here using SendGrid/Resend
        // For now, we simulate success and log to audit
        await db.prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES (?, 'RESET_REQUEST', 'auth', ?)")
            .run(user.id, user.id);

        return NextResponse.json({
            message: "Security reset initialized.",
            token: process.env.NODE_ENV !== 'production' ? token : undefined // Only show in dev for easy testing
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
