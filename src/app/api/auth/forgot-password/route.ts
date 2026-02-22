import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ error: "Email is required." }, { status: 400 });
        }

        const user = await db.prepare("SELECT id FROM public.users WHERE email = ?").get(email) as any;

        if (!user) {
            // Industrial security: don't reveal if email exists, just return success
            return NextResponse.json({ message: "Recovery email has been dispatched if account exists." });
        }

        // Generate industrial secure token
        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 3600000); // 1 hour

        await db.prepare(
            "UPDATE public.users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?"
        ).run(token, expiry.toISOString(), user.id);

        // Industrial Email Notification (Non-blocking)
        try {
            const { sendPasswordResetEmail } = require("@/lib/email");
            await sendPasswordResetEmail(email, user.full_name || "User", token);
        } catch (e) {
            console.error("Password reset email failed", e);
            // In dev we might still want to see it if API key is missing
            if (process.env.NODE_ENV === 'development') {
                return NextResponse.json({ message: "Dev Mode: Email failed, token: " + token, token });
            }
        }

        return NextResponse.json({
            message: "Recovery dispatch initialized. Please check your inbox for instructions.",
        });

    } catch (e: any) {
        console.error("[FORGOT_PASSWORD_ERROR]", e.message);
        return NextResponse.json({ error: "Could not initialize password reset." }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const { token, newPassword } = await req.json();

        if (!token || !newPassword) {
            return NextResponse.json({ error: "Invalid request parameters." }, { status: 400 });
        }

        const user = await db.prepare(
            "SELECT id FROM public.users WHERE reset_token = ? AND reset_token_expiry > ?"
        ).get(token, new Date().toISOString()) as any;

        if (!user) {
            return NextResponse.json({ error: "Invalid or expired recovery link." }, { status: 400 });
        }

        const bcrypt = require("bcryptjs");
        const hash = bcrypt.hashSync(newPassword, 10);

        await db.prepare(
            "UPDATE public.users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?"
        ).run(hash, user.id);

        await db.prepare(
            "INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id) VALUES (?, 'PASSWORD_RESET', 'user', ?)"
        ).run(user.id, user.id);

        return NextResponse.json({ message: "Security credentials updated successfully." });

    } catch (e: any) {
        console.error("[RESET_PASSWORD_ERROR]", e.message);
        return NextResponse.json({ error: "Update failed." }, { status: 500 });
    }
}
