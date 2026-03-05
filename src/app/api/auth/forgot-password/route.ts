import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPasswordResetEmail } from "@/lib/email";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );
}

// ─── POST: Request password reset (sends email) ───
export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json();

        if (!email || typeof email !== "string") {
            return NextResponse.json({ error: "Email is required." }, { status: 400 });
        }

        // Normalize email
        const normalizedEmail = email.trim().toLowerCase();

        const supabase = getSupabase();

        // Look up the user
        const { data: user } = await supabase
            .from("users")
            .select("id, full_name, email, is_active")
            .eq("email", normalizedEmail)
            .single();

        if (!user || !user.is_active) {
            // Security: don't reveal if account exists or is inactive
            return NextResponse.json({
                message: "If an account exists with this email, a password reset link has been sent.",
            });
        }

        // Generate cryptographically secure token
        const token = crypto.randomBytes(32).toString("hex");
        const expiry = new Date(Date.now() + 3600000).toISOString(); // 1 hour

        // Save token to DB
        const { error: updateErr } = await supabase
            .from("users")
            .update({
                reset_token: token,
                reset_token_expiry: expiry,
            })
            .eq("id", user.id);

        if (updateErr) {
            console.error("[FORGOT_PASSWORD] DB update error:", updateErr.message);
            return NextResponse.json({ error: "Could not process reset request." }, { status: 500 });
        }

        // Send email with reset link
        try {
            await sendPasswordResetEmail(user.email, user.full_name || "User", token);
        } catch (emailErr: any) {
            console.error("[FORGOT_PASSWORD] Email send error:", emailErr.message);
            // Don't fail the request if email fails, but log it
        }

        // Audit log
        try {
            await supabase.from("audit_logs").insert({
                user_id: user.id,
                action: "PASSWORD_RESET_REQUEST",
                entity_type: "user",
                entity_id: user.id,
            });
        } catch (e) { /* non-critical */ }

        return NextResponse.json({
            message: "If an account exists with this email, a password reset link has been sent.",
        });
    } catch (e: any) {
        console.error("[FORGOT_PASSWORD_ERROR]", e.message);
        return NextResponse.json({ error: "Could not process reset request." }, { status: 500 });
    }
}

// ─── PUT: Confirm password reset (validates token + updates password) ───
export async function PUT(req: NextRequest) {
    try {
        const { token, newPassword } = await req.json();

        if (!token || !newPassword) {
            return NextResponse.json({ error: "Token and new password are required." }, { status: 400 });
        }

        // Password strength validation
        if (newPassword.length < 8) {
            return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
        }

        if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
            return NextResponse.json({
                error: "Password must contain uppercase, lowercase, and a number.",
            }, { status: 400 });
        }

        // Sanitize token - only allow hex characters
        if (!/^[a-f0-9]{64}$/.test(token)) {
            return NextResponse.json({ error: "Invalid reset token format." }, { status: 400 });
        }

        const supabase = getSupabase();

        // Find user by token (check expiry)
        const { data: user } = await supabase
            .from("users")
            .select("id, email, full_name, reset_token_expiry")
            .eq("reset_token", token)
            .single();

        if (!user) {
            return NextResponse.json({ error: "Invalid or expired reset link. Please request a new one." }, { status: 400 });
        }

        // Check token expiry
        const tokenExpiry = new Date(user.reset_token_expiry);
        if (tokenExpiry < new Date()) {
            // Clear expired token
            await supabase
                .from("users")
                .update({ reset_token: null, reset_token_expiry: null })
                .eq("id", user.id);

            return NextResponse.json({
                error: "This reset link has expired. Please request a new one.",
            }, { status: 400 });
        }

        // Hash new password with bcrypt (cost factor 12 for production security)
        const hash = await bcrypt.hash(newPassword, 12);

        // Update password and clear token (atomic operation)
        const { error: updateErr } = await supabase
            .from("users")
            .update({
                password_hash: hash,
                reset_token: null,
                reset_token_expiry: null,
            })
            .eq("id", user.id);

        if (updateErr) {
            console.error("[RESET_PASSWORD] DB update error:", updateErr.message);
            return NextResponse.json({ error: "Could not update password." }, { status: 500 });
        }

        // Audit log
        try {
            await supabase.from("audit_logs").insert({
                user_id: user.id,
                action: "PASSWORD_RESET_COMPLETE",
                entity_type: "user",
                entity_id: user.id,
            });
        } catch (e) { /* non-critical */ }

        return NextResponse.json({ message: "Password updated successfully." });
    } catch (e: any) {
        console.error("[RESET_PASSWORD_ERROR]", e.message);
        return NextResponse.json({ error: "Could not process password reset." }, { status: 500 });
    }
}
