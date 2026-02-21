import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
    try {
        const { token, newPassword } = await req.json();

        if (!token || !newPassword) {
            return NextResponse.json({ error: "Token and new password are required." }, { status: 400 });
        }

        // Password strength: minimum 8 characters
        if (newPassword.length < 8) {
            return NextResponse.json({ error: "Password must be at least 8 characters long." }, { status: 400 });
        }

        const user = await db.prepare(
            "SELECT id FROM users WHERE reset_token = ? AND reset_expires > CURRENT_TIMESTAMP"
        ).get(token) as any;

        if (!user) {
            return NextResponse.json({ error: "Invalid or expired reset token." }, { status: 400 });
        }

        // Hash with cost factor 12 for production strength
        const hash = await bcrypt.hash(newPassword, 12);

        await db.prepare(
            "UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?"
        ).run(hash, user.id);

        await db.prepare(
            "INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES (?, 'PASSWORD_CHANGE', 'auth', ?)"
        ).run(user.id, user.id);

        return NextResponse.json({ message: "Password updated successfully." });
    } catch (e: any) {
        console.error("[RESET_CONFIRM_ERROR]", e.message);
        return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
    }
}
