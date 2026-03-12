/**
 * Production-Grade Rate Limiter
 * 
 * Sliding window in-memory rate limiter with configurable limits per route.
 * On Vercel serverless, each cold start gets a fresh Map — which is acceptable
 * for burst protection. For persistent cross-instance limiting, swap to
 * Upstash Redis (@upstash/ratelimit).
 * 
 * Usage:
 *   import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
 *   const limiter = rateLimit(RATE_LIMITS.API_GENERAL);
 *   const result = limiter.check(ip);
 *   if (!result.success) return NextResponse.json({...}, { status: 429 });
 */

interface RateLimitConfig {
    /** Maximum number of requests allowed in the window */
    maxRequests: number;
    /** Time window in milliseconds */
    windowMs: number;
    /** Human-readable identifier for logging */
    name: string;
}

interface RateLimitEntry {
    tokens: number;
    lastRefill: number;
}

interface RateLimitResult {
    success: boolean;
    remaining: number;
    resetMs: number;
    limit: number;
}

/**
 * Preconfigured rate limit profiles for different route categories.
 * Adjust these values based on expected traffic patterns.
 */
export const RATE_LIMITS = {
    /** Auth endpoints — strict to prevent brute force */
    AUTH_LOGIN: {
        maxRequests: 10,
        windowMs: 15 * 60 * 1000, // 15 minutes
        name: "auth_login",
    },
    AUTH_SIGNUP: {
        maxRequests: 5,
        windowMs: 60 * 60 * 1000, // 1 hour
        name: "auth_signup",
    },
    AUTH_FORGOT_PASSWORD: {
        maxRequests: 3,
        windowMs: 15 * 60 * 1000, // 15 minutes
        name: "auth_forgot_password",
    },
    /** General API — moderate limits */
    API_GENERAL: {
        maxRequests: 100,
        windowMs: 60 * 1000, // 1 minute
        name: "api_general",
    },
    /** Write operations — stricter */
    API_WRITE: {
        maxRequests: 30,
        windowMs: 60 * 1000, // 1 minute
        name: "api_write",
    },
    /** Reports / heavy read — limit to prevent DB overload */
    API_REPORTS: {
        maxRequests: 20,
        windowMs: 60 * 1000, // 1 minute
        name: "api_reports",
    },
    /** Debug/Admin endpoints — very strict */
    API_DEBUG: {
        maxRequests: 5,
        windowMs: 60 * 1000, // 1 minute
        name: "api_debug",
    },
} as const;

// Per-limiter stores (one Map per config name)
const stores = new Map<string, Map<string, RateLimitEntry>>();

// Periodic cleanup to prevent memory leaks (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
    if (cleanupTimer) return;
    cleanupTimer = setInterval(() => {
        const now = Date.now();
        for (const [, store] of stores) {
            for (const [key, entry] of store) {
                // Remove entries that haven't been accessed for 30 minutes
                if (now - entry.lastRefill > 30 * 60 * 1000) {
                    store.delete(key);
                }
            }
        }
    }, CLEANUP_INTERVAL);
    // Allow Node.js to exit even if timer is running
    if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
        cleanupTimer.unref();
    }
}

/**
 * Creates a rate limiter instance with token-bucket algorithm.
 */
export function rateLimit(config: RateLimitConfig) {
    let store = stores.get(config.name);
    if (!store) {
        store = new Map<string, RateLimitEntry>();
        stores.set(config.name, store);
        ensureCleanup();
    }

    return {
        /**
         * Check if a request from the given identifier is allowed.
         * @param identifier — typically IP address or user ID
         */
        check(identifier: string): RateLimitResult {
            const now = Date.now();
            const entry = store!.get(identifier);

            if (!entry) {
                // First request
                store!.set(identifier, {
                    tokens: config.maxRequests - 1,
                    lastRefill: now,
                });
                return {
                    success: true,
                    remaining: config.maxRequests - 1,
                    resetMs: now + config.windowMs,
                    limit: config.maxRequests,
                };
            }

            // Calculate tokens to refill based on elapsed time
            const elapsed = now - entry.lastRefill;
            const refillRate = config.maxRequests / config.windowMs;
            const tokensToAdd = elapsed * refillRate;
            const newTokens = Math.min(config.maxRequests, entry.tokens + tokensToAdd);

            if (newTokens < 1) {
                // Rate limited
                const waitTime = (1 - newTokens) / refillRate;
                return {
                    success: false,
                    remaining: 0,
                    resetMs: now + Math.ceil(waitTime),
                    limit: config.maxRequests,
                };
            }

            // Consume a token
            entry.tokens = newTokens - 1;
            entry.lastRefill = now;

            return {
                success: true,
                remaining: Math.floor(entry.tokens),
                resetMs: now + config.windowMs,
                limit: config.maxRequests,
            };
        },

        /**
         * Returns rate-limit response headers (RFC 6585 / draft-ietf-httpapi-ratelimit-headers)
         */
        headers(result: RateLimitResult): Record<string, string> {
            return {
                "X-RateLimit-Limit": String(result.limit),
                "X-RateLimit-Remaining": String(result.remaining),
                "X-RateLimit-Reset": String(Math.ceil(result.resetMs / 1000)),
                ...(result.success ? {} : { "Retry-After": String(Math.ceil((result.resetMs - Date.now()) / 1000)) }),
            };
        },
    };
}

/**
 * Helper to extract client IP from a Next.js request.
 */
export function getClientIp(req: Request): string {
    const headers = req.headers;
    return (
        headers.get("x-forwarded-for")?.split(",")[0].trim() ||
        headers.get("x-real-ip") ||
        headers.get("cf-connecting-ip") || // Cloudflare
        "127.0.0.1"
    );
}
