import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signToken } from "@/lib/auth";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

// Simple in-memory rate limiter: max 10 attempts per IP per 15 minutes
const loginAttempts = new Map<string, { count: number; reset: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 min

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.reset) {
    loginAttempts.set(ip, { count: 1, reset: now + WINDOW_MS });
    return true; // allowed
  }
  if (entry.count >= MAX_ATTEMPTS) return false; // blocked
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  // Rate limit check
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

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email format." }, { status: 400 });
    }

    const user = await db
      .prepare(
        `SELECT u.*, r.name as role_name 
         FROM public.users u 
         JOIN public.roles r ON u.role_id = r.id 
         WHERE u.email = ? AND u.is_active = TRUE 
         LIMIT 1`
      )
      .get(email) as any;

    // Constant-time comparison — always run bcrypt to prevent timing attacks
    const dummyHash = "$2b$10$invalidsaltinvalidsaltinvalidsal";
    const isValid = user
      ? await bcrypt.compare(password, user.password_hash)
      : await bcrypt.compare(password, dummyHash).then(() => false);

    if (!user || !isValid) {
      // Log failed attempt to audit
      if (user) {
        try {
          await db.prepare(
            "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address) VALUES (?, 'LOGIN_FAILED', 'auth', ?, ?)"
          ).run(user.id, user.id, ip);
        } catch { /* non-blocking */ }
      }
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const token = await signToken({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role_name,
      role_id: user.role_id,
      department: user.department,
    });

    // Log successful login
    try {
      await db.prepare(
        "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address) VALUES (?, 'LOGIN', 'auth', ?, ?)"
      ).run(user.id, user.id, ip);
    } catch { /* non-blocking */ }

    const res = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role_name,
        department: user.department,
      },
    });

    // Secure HttpOnly cookie
    res.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8, // 8 hours (matches JWT expiry)
      path: "/",
    });

    // Security response headers
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("X-Frame-Options", "DENY");

    return res;
  } catch (e: any) {
    console.error("[LOGIN_ERROR]", e.message);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
