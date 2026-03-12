import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendAdminSignupNotification } from "@/lib/email";
import { rateLimit, RATE_LIMITS, getClientIp } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

const signupLimiter = rateLimit(RATE_LIMITS.AUTH_SIGNUP);

export async function POST(req: NextRequest) {
    try {
        // Rate limit check
        const ip = getClientIp(req);
        const rl = signupLimiter.check(ip);
        if (!rl.success) {
            const response = NextResponse.json(
                { error: "Too many signup attempts. Please try again later." },
                { status: 429 }
            );
            Object.entries(signupLimiter.headers(rl)).forEach(([k, v]) => response.headers.set(k, v));
            return response;
        }

        const body = await req.json();
        const { email, password, full_name, role_id, department } = body;

        if (!email || !password || !full_name || !role_id) {
            return NextResponse.json({ error: "All fields are required." }, { status: 400 });
        }

        // Validate email
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json({ error: "Invalid email format." }, { status: 400 });
        }

        // Restricted Roles (Admins cannot self-signup)
        if (parseInt(role_id) === 1) {
            return NextResponse.json({ error: "Administrative accounts must be created by an existing Admin." }, { status: 403 });
        }

        const existing = await db.prepare("SELECT id FROM public.users WHERE email = ?").get(email);
        if (existing) {
            return NextResponse.json({ error: "Account already exists with this email." }, { status: 409 });
        }

        const hash = bcrypt.hashSync(password, 10);

        // Created as INACTIVE and PENDING
        const result = await db.prepare(
            "INSERT INTO public.users (email, password_hash, full_name, role_id, department, is_active, approval_status) VALUES (?, ?, ?, ?, ?, FALSE, 'pending') RETURNING id"
        ).run(email, hash, full_name, role_id, department || "");

        const userId = (result as any).lastInsertRowid || 0;

        // Log the signup attempt
        await db.prepare(
            "INSERT INTO public.audit_logs (action, entity_type, entity_id, new_value) VALUES ('SIGNUP_REQUEST', 'user', ?, ?)"
        ).run(userId, JSON.stringify({ email, full_name, role_id }));

        // Industrial Notification System (In-Dashboard + Email)
        try {
            const admins = await db.prepare("SELECT id, email FROM public.users WHERE role_id = 1 AND is_active = TRUE").all() as any[];
            const roleNameMap: any = { "2": "Manager", "3": "Accounts", "4": "Salesperson" };
            const requestedRole = roleNameMap[role_id] || "User";

            for (const admin of admins) {
                // 1. Persistent Dashboard Notification
                await db.prepare(`
                    INSERT INTO public.notifications (user_id, title, message, type)
                    VALUES (?, 'New Access Request', ?, 'action_required')
                `).run(admin.id, `Staff member ${full_name} (${email}) has requested ${requestedRole} access.`);

                // 2. Automated Email Alert
                if (admin.email) {
                    await sendAdminSignupNotification(admin.email, full_name, email, requestedRole);
                }
            }
        } catch (e) {
            console.warn("Unified notification dispatch deferred:", e);
        }

        return NextResponse.json({
            message: "Registration successful. Your account is now in the queue for Admin approval.",
            status: "pending"
        });

    } catch (e: any) {
        console.error("[SIGNUP_ERROR]", e.message);
        return NextResponse.json({ error: "An unexpected error occurred during registration." }, { status: 500 });
    }
}
