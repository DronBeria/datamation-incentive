/**
 * API Key Management for External / Webhook / Cron Integrations
 * 
 * Supports two modes:
 *   1. Server-side API keys (stored in env vars) for cron jobs, webhooks, integrations
 *   2. JWT-based session auth (existing auth.ts) for browser/dashboard users
 * 
 * Usage:
 *   import { validateApiKey, API_KEY_HEADER } from "@/lib/api-keys";
 *   const isValid = validateApiKey(req, "CRON_SECRET");
 *   if (!isValid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
 */

import { NextRequest, NextResponse } from "next/server";

/** Standard header name for API key authentication */
export const API_KEY_HEADER = "x-api-key";

/** Alternative header (used by Vercel Cron, AWS Lambda, etc.) */
export const AUTH_BEARER_HEADER = "authorization";

/**
 * Known API key types and their corresponding environment variable names.
 * Add new keys here as integrations grow.
 */
export const API_KEY_NAMES = {
    /** Used by Vercel Cron Jobs */
    CRON_SECRET: "CRON_SECRET",
    /** Used by Stitch payment integration */
    STITCH_API_KEY: "STITCH_API_KEY",
    /** Generic external API key for third-party integrations */
    EXTERNAL_API_KEY: "EXTERNAL_API_KEY",
} as const;

type ApiKeyName = keyof typeof API_KEY_NAMES;

/**
 * Validates an API key from request headers against the environment variable.
 * Supports both `x-api-key: <key>` and `Authorization: Bearer <key>` formats.
 * 
 * @param req - The incoming request
 * @param keyName - Which API key to validate against (matches env var name)
 * @returns boolean — true if valid
 */
export function validateApiKey(
    req: Request | NextRequest,
    keyName: ApiKeyName
): boolean {
    const envKey = process.env[API_KEY_NAMES[keyName]];

    // If the env key is not configured, deny in production, allow in dev
    if (!envKey) {
        if (process.env.NODE_ENV === "production") {
            console.error(`[API_KEY] Missing env var: ${API_KEY_NAMES[keyName]}`);
            return false;
        }
        console.warn(`[API_KEY] ${API_KEY_NAMES[keyName]} not set — allowing in dev mode`);
        return true;
    }

    // Check x-api-key header
    const apiKeyHeader = req.headers.get(API_KEY_HEADER);
    if (apiKeyHeader && timingSafeEqual(apiKeyHeader, envKey)) {
        return true;
    }

    // Check Authorization: Bearer <key>
    const authHeader = req.headers.get(AUTH_BEARER_HEADER);
    if (authHeader) {
        const parts = authHeader.split(" ");
        if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
            if (timingSafeEqual(parts[1], envKey)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Uses XOR comparison of character codes.
 */
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
        // Still do the comparison to avoid timing leak on length
        let result = a.length ^ b.length;
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            result |= (a.charCodeAt(i % a.length) || 0) ^ (b.charCodeAt(i % b.length) || 0);
        }
        return result === 0;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

/**
 * Helper to create a standardized 401/403 response for API key failures.
 */
export function unauthorizedApiResponse(message = "Invalid or missing API key") {
    return NextResponse.json(
        {
            error: message,
            code: "INVALID_API_KEY",
        },
        {
            status: 403,
            headers: {
                "WWW-Authenticate": `Bearer realm="IncentivePro-api"`,
            },
        }
    );
}
