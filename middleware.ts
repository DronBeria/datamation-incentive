import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || "payoutpower-dev-secret-change-in-production-2026"
);

// Security headers applied to every response
const SECURITY_HEADERS = {
    "X-DNS-Prefetch-Control": "on",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

function applySecurityHeaders(response: NextResponse): NextResponse {
    Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
        response.headers.set(key, value);
    });
    return response;
}

// Roles allowed for specific protected routes
const ROUTE_ROLE_MAP: Record<string, string[]> = {
    "/dashboard/users": ["admin", "manager"],
    "/dashboard/audit": ["admin"],
    "/dashboard/schemes": ["admin", "manager"],
    "/dashboard/reports": ["admin", "manager", "accounts"],
    "/dashboard/adjustments": ["admin", "manager", "accounts"],
};

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const token = request.cookies.get("token")?.value;

    // ── Pass-through: public routes and Next.js internals ──
    const isPublicRoute =
        pathname === "/" ||
        pathname === "/login" ||
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
                    NextResponse.redirect(new URL("/dashboard", request.url))
                );
            } catch {
                // Token invalid — let them stay on login, clear the bad cookie
                const res = applySecurityHeaders(NextResponse.next());
                res.cookies.delete("token");
                return res;
            }
        }
        return applySecurityHeaders(NextResponse.next());
    }

    // ── Protected: /dashboard/* ──
    if (pathname.startsWith("/dashboard")) {
        if (!token) {
            const res = NextResponse.redirect(new URL("/", request.url));
            return applySecurityHeaders(res);
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
                        NextResponse.redirect(new URL("/dashboard", request.url))
                    );
                }
            }

            return applySecurityHeaders(NextResponse.next());
        } catch {
            // Invalid / expired token → clear cookie and redirect to login
            const res = NextResponse.redirect(new URL("/", request.url));
            res.cookies.delete("token");
            return applySecurityHeaders(res);
        }
    }

    // ── Protected: /api/* (except auth endpoints) ──
    if (
        pathname.startsWith("/api/") &&
        !pathname.startsWith("/api/auth/")
    ) {
        if (!token) {
            return applySecurityHeaders(
                NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
            return applySecurityHeaders(res);
        }
    }

    return applySecurityHeaders(NextResponse.next());
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
