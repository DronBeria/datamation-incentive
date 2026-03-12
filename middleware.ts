import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || "payoutpower-dev-secret-change-in-production-2026"
);

// ─── Security headers applied to every response ───
const SECURITY_HEADERS = {
    "X-DNS-Prefetch-Control": "on",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-XSS-Protection": "1; mode=block",
    "Content-Security-Policy": "frame-ancestors 'none'",
};

// CORS: Allow same-origin + configured APP_URL + Electron desktop
const ALLOWED_ORIGINS = [
    process.env.NEXT_PUBLIC_APP_URL,
    "http://localhost:3000",
    "http://localhost:3001",
    "app://.",  // Electron origin
].filter(Boolean) as string[];

function applySecurityHeaders(response: NextResponse, origin?: string | null): NextResponse {
    Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
        response.headers.set(key, value);
    });

    // CORS headers for API routes
    if (origin && ALLOWED_ORIGINS.some(ao => origin.startsWith(ao!))) {
        response.headers.set("Access-Control-Allow-Origin", origin);
        response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
        response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
        response.headers.set("Access-Control-Allow-Credentials", "true");
        response.headers.set("Access-Control-Max-Age", "86400"); // 24hr preflight cache
    }

    return response;
}

// ─── Edge-compatible Rate Limiter (sliding window) ───
interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Different rate limit profiles for different route categories
const RATE_CONFIGS: Record<string, { max: number; windowMs: number }> = {
    "/api/auth/login": { max: 10, windowMs: 15 * 60 * 1000 },     // 10 / 15min
    "/api/auth/signup": { max: 5, windowMs: 60 * 60 * 1000 },      // 5 / hour
    "/api/auth/forgot-password": { max: 3, windowMs: 15 * 60 * 1000 }, // 3 / 15min
    "/api/debug": { max: 5, windowMs: 60 * 1000 },                 // 5 / min
    "/api/reports": { max: 20, windowMs: 60 * 1000 },              // 20 / min
    "/api": { max: 100, windowMs: 60 * 1000 },                     // 100 / min (default API)
};

function getRateLimitConfig(pathname: string): { max: number; windowMs: number } {
    // Check specific routes first, fall back to general
    for (const [prefix, config] of Object.entries(RATE_CONFIGS)) {
        if (prefix !== "/api" && pathname.startsWith(prefix)) {
            return config;
        }
    }
    if (pathname.startsWith("/api")) return RATE_CONFIGS["/api"];
    return { max: 200, windowMs: 60 * 1000 }; // Very lenient for pages
}

function checkRateLimit(ip: string, pathname: string): { allowed: boolean; remaining: number; resetAt: number } {
    const config = getRateLimitConfig(pathname);
    const key = `${ip}:${pathname.split("/").slice(0, 4).join("/")}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    // Dynamic Cleanup: Occasionally purge very old entries to prevent Map growth
    if (Math.random() < 0.05) { // 5% of requests trigger a partial cleanup
        for (const [k, e] of rateLimitStore) {
            if (now > e.resetAt + 600000) rateLimitStore.delete(k); // Delete if expired > 10min ago
        }
    }

    if (!entry || now > entry.resetAt) {
        rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs });
        return { allowed: true, remaining: config.max - 1, resetAt: now + config.windowMs };
    }

    if (entry.count >= config.max) {
        return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count++;
    return { allowed: true, remaining: config.max - entry.count, resetAt: entry.resetAt };
}

// ─── Roles allowed for specific protected routes ───
const ROUTE_ROLE_MAP: Record<string, string[]> = {
    "/dashboard/users": ["admin", "manager"],
    "/dashboard/audit": ["admin"],
    "/dashboard/schemes": ["admin", "manager"],
    "/dashboard/reports": ["admin", "manager", "accounts"],
    "/dashboard/adjustments": ["admin", "manager", "accounts", "salesperson"],
};

function getClientIp(request: NextRequest): string {
    return (
        request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
        request.headers.get("x-real-ip") ||
        request.headers.get("cf-connecting-ip") ||
        "127.0.0.1"
    );
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const token = request.cookies.get("token")?.value;
    const origin = request.headers.get("origin");

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
        return applySecurityHeaders(new NextResponse(null, { status: 204 }), origin);
    }

    // ── Pass-through: public routes and Next.js internals ──
    const isPublicRoute =
        pathname === "/" ||
        pathname === "/login" ||
        pathname === "/reset-password" ||
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon");

    if (isPublicRoute) {
        // Redirect authenticated users away from login
        if (token && (pathname === "/" || pathname === "/login")) {
            try {
                await jwtVerify(token, JWT_SECRET, {
                    issuer: "payoutpower-ims",
                    audience: "payoutpower-client",
                });
                return applySecurityHeaders(
                    NextResponse.redirect(new URL("/dashboard", request.url)),
                    origin
                );
            } catch {
                // Token invalid — let them stay on login, clear the bad cookie
                const res = applySecurityHeaders(NextResponse.next(), origin);
                res.cookies.delete("token");
                return res;
            }
        }
        return applySecurityHeaders(NextResponse.next(), origin);
    }

    // ── Rate Limiting (all non-public routes) ──
    const ip = getClientIp(request);
    const { allowed, remaining, resetAt } = checkRateLimit(ip, pathname);

    if (!allowed) {
        const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
        const res = pathname.startsWith("/api/")
            ? NextResponse.json(
                { error: "Rate limit exceeded. Please slow down.", code: "RATE_LIMITED" },
                { status: 429 }
            )
            : NextResponse.redirect(new URL("/?error=rate_limited", request.url));

        res.headers.set("Retry-After", String(retryAfter));
        res.headers.set("X-RateLimit-Remaining", "0");
        res.headers.set("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
        return applySecurityHeaders(res, origin);
    }

    // ── Protected: /dashboard/* ──
    if (pathname.startsWith("/dashboard")) {
        if (!token) {
            const res = NextResponse.redirect(new URL("/", request.url));
            return applySecurityHeaders(res, origin);
        }

        try {
            const { payload } = await jwtVerify(token, JWT_SECRET, {
                issuer: "payoutpower-ims",
                audience: "payoutpower-client",
            });
            const role = (payload as any).role as string;

            // Check route-specific role requirements
            for (const [route, allowedRoles] of Object.entries(ROUTE_ROLE_MAP)) {
                if (pathname.startsWith(route) && !allowedRoles.includes(role)) {
                    return applySecurityHeaders(
                        NextResponse.redirect(new URL("/dashboard", request.url)),
                        origin
                    );
                }
            }

            const res = applySecurityHeaders(NextResponse.next(), origin);
            res.headers.set("X-RateLimit-Remaining", String(remaining));
            return res;
        } catch {
            // Invalid / expired token → clear cookie and redirect to login
            const res = NextResponse.redirect(new URL("/", request.url));
            res.cookies.delete("token");
            return applySecurityHeaders(res, origin);
        }
    }

    // ── Protected: /api/* (except auth endpoints & cron with API key) ──
    if (pathname.startsWith("/api/")) {
        const isAuthRoute = pathname.startsWith("/api/auth/");
        const isCronRoute = pathname.startsWith("/api/cron/");

        // Cron routes use API key authentication
        if (isCronRoute) {
            const authHeader = request.headers.get("authorization");
            const cronSecret = process.env.CRON_SECRET;

            if (process.env.NODE_ENV === "production") {
                if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
                    return applySecurityHeaders(
                        NextResponse.json({ error: "Unauthorized cron access" }, { status: 401 }),
                        origin
                    );
                }
            }
            const res = applySecurityHeaders(NextResponse.next(), origin);
            res.headers.set("X-RateLimit-Remaining", String(remaining));
            return res;
        }

        // Auth routes are public
        if (isAuthRoute) {
            const res = applySecurityHeaders(NextResponse.next(), origin);
            res.headers.set("X-RateLimit-Remaining", String(remaining));
            return res;
        }

        // Debug routes — require auth AND are NOT publicly accessible
        if (pathname.startsWith("/api/debug/")) {
            if (!token) {
                return applySecurityHeaders(
                    NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
                    origin
                );
            }
            try {
                const { payload } = await jwtVerify(token, JWT_SECRET, {
                    issuer: "payoutpower-ims",
                    audience: "payoutpower-client",
                });
                if ((payload as any).role !== "admin") {
                    return applySecurityHeaders(
                        NextResponse.json({ error: "Admin access required" }, { status: 403 }),
                        origin
                    );
                }
            } catch {
                const res = NextResponse.json({ error: "Session expired" }, { status: 401 });
                res.cookies.delete("token");
                return applySecurityHeaders(res, origin);
            }
        }

        // All other API routes require JWT
        if (!token) {
            return applySecurityHeaders(
                NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
                origin
            );
        }
        try {
            await jwtVerify(token, JWT_SECRET, {
                issuer: "payoutpower-ims",
                audience: "payoutpower-client",
            });
        } catch {
            const res = NextResponse.json({ error: "Session expired" }, { status: 401 });
            res.cookies.delete("token");
            return applySecurityHeaders(res, origin);
        }
    }

    const res = applySecurityHeaders(NextResponse.next(), origin);
    res.headers.set("X-RateLimit-Remaining", String(remaining));
    return res;
}

export const config = {
    matcher: [
        /*
         * Match all paths EXCEPT:
         * - _next/static (static files)
         * - _next/image  (image optimization)
         * - favicon.ico
         * - public folder files
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
