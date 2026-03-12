import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendAdminSignupNotification } from "@/lib/email";
import { rateLimit, RATE_LIMITS, getClientIp } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );
}

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

        const supabase = getSupabase();

        // Check existing user — direct Supabase query (fast)
        const { data: existing } = await supabase
            .from("users")
            .select("id")
            .eq("email", email)
            .single();

        if (existing) {
            return NextResponse.json({ error: "Account already exists with this email." }, { status: 409 });
        }

        // Async bcrypt hash (non-blocking, ~10x faster than hashSync)
        const hash = await bcrypt.hash(password, 10);

        // Insert user — direct Supabase insert (fast)
        const { data: newUser, error: insertErr } = await supabase
            .from("users")
            .insert({
                email,
                password_hash: hash,
                full_name,
                role_id: parseInt(role_id),
                department: department || "",
                is_active: false,
                approval_status: "pending",
            })
            .select("id")
            .single();

        if (insertErr) {
            console.error("[SIGNUP] Insert error:", insertErr.message);
            return NextResponse.json({ error: "Could not create account. Please try again." }, { status: 500 });
        }

        const userId = newUser?.id || 0;

        // Respond IMMEDIATELY — don't make the user wait for notifications
        const response = NextResponse.json({
            message: "Registration successful. Your account is now in the queue for Admin approval.",
            status: "pending"
        });

        // Fire-and-forget: audit log + admin notifications (non-blocking)
        (async () => {
            try {
                // Audit log
                await supabase.from("audit_logs").insert({
                    action: "SIGNUP_REQUEST",
                    entity_type: "user",
                    entity_id: userId,
                    new_value: JSON.stringify({ email, full_name, role_id }),
                });

                // Notify admins (dashboard + email)
                const { data: admins } = await supabase
                    .from("users")
                    .select("id, email")
                    .eq("role_id", 1)
                    .eq("is_active", true);

                const roleNameMap: Record<string, string> = { "2": "Manager", "3": "Accounts", "4": "Salesperson" };
                const requestedRole = roleNameMap[role_id] || "User";

                for (const admin of (admins || [])) {
                    // Dashboard notification
                    supabase.from("notifications").insert({
                        user_id: admin.id,
                        title: "New Access Request",
                        message: `Staff member ${full_name} (${email}) has requested ${requestedRole} access.`,
                        type: "action_required",
                    }).then(() => { }).catch(() => { });

                    // Email alert (fire-and-forget)
                    if (admin.email) {
                        sendAdminSignupNotification(admin.email, full_name, email, requestedRole).catch(() => { });
                    }
                }
            } catch (e) {
                console.warn("Background notification dispatch error:", e);
            }
        })();

        return response;

    } catch (e: any) {
        console.error("[SIGNUP_ERROR]", e.message);
        return NextResponse.json({ error: "An unexpected error occurred during registration." }, { status: 500 });
    }
}
