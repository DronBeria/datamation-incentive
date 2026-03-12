import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { signToken } from "@/lib/auth";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Simple in-memory rate limiter: max 10 attempts per IP per 15 minutes
const loginAttempts = new Map<string, { count: number; reset: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 min

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.reset) {
    loginAttempts.set(ip, { count: 1, reset: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again in 15 minutes." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email format." }, { status: 400 });
    }

    const supabase = getSupabase();

    // Direct Supabase query — much faster than exec_sql RPC
    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("id, email, password_hash, full_name, role_id, department, is_active, approval_status")
      .eq("email", email)
      .single();

    // Also fetch the role name in parallel if user exists
    let roleName = "";
    if (user) {
      const { data: role } = await supabase
        .from("roles")
        .select("name")
        .eq("id", user.role_id)
        .single();
      roleName = role?.name || "";
    }

    if (user && (!user.is_active || user.is_active === false)) {
      return NextResponse.json({ error: "Access Denied: Your account has been deactivated by an administrator." }, { status: 403 });
    }

    if (user && user.approval_status === "pending") {
      return NextResponse.json({ error: "Waiting for admin approval. Please contact support." }, { status: 403 });
    }

    if (user && user.approval_status === "rejected") {
      return NextResponse.json({ error: "Access denied. Your signup request has been rejected." }, { status: 403 });
    }

    // Constant-time comparison — always run bcrypt to prevent timing attacks
    const dummyHash = "$2b$10$invalidsaltinvalidsaltinvalidsal";
    const isValid = user
      ? await bcrypt.compare(password, user.password_hash)
      : await bcrypt.compare(password, dummyHash).then(() => false);

    if (!user || !isValid) {
      // Fire-and-forget failed login audit
      if (user) {
        supabase.from("audit_logs").insert({
          user_id: user.id,
          action: "LOGIN_FAILED",
          entity_type: "auth",
          entity_id: user.id,
          ip_address: ip,
        }).then(() => { }).catch(() => { });
      }
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const token = await signToken({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: roleName,
      role_id: user.role_id,
      department: user.department,
    });

    // Fire-and-forget: update last_login + audit log (don't block the response)
    supabase
      .from("users")
      .update({ last_login: new Date().toISOString() })
      .eq("id", user.id)
      .then(() => { }).catch(() => { });

    supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "LOGIN",
      entity_type: "auth",
      entity_id: user.id,
      ip_address: ip,
    }).then(() => { }).catch(() => { });

    const res = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: roleName,
        department: user.department,
      },
    });

    // Secure HttpOnly cookie
    res.cookies.set("token", token, {
      httpOnly: true,
      secure: req.url.startsWith("https://"),
      sameSite: "lax",
      maxAge: 60 * 60 * 8,
      path: "/",
    });

    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("X-Frame-Options", "DENY");

    return res;
  } catch (e: any) {
    console.error("[LOGIN_ERROR]", e.message);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
