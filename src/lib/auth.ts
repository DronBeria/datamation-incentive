import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// Fallback secret for development/build only. 
// REAL production environments MUST set JWT_SECRET environment variable.
const rawSecret = process.env.JWT_SECRET;
if (!rawSecret && process.env.NODE_ENV === "production") {
  console.warn("WARNING: JWT_SECRET environment variable is not set! Using development fallback. This is INSECURE for production.");
}
const JWT_SECRET = new TextEncoder().encode(
  rawSecret || "payoutpower-dev-secret-change-in-production-2026"
);

const TOKEN_EXPIRY = "8h";
const COOKIE_NAME = "token";

export type UserPayload = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  role_id: string;
  department?: string;
};

export async function signToken(payload: UserPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(TOKEN_EXPIRY)
    .setIssuedAt()
    .setIssuer("payoutpower-ims")
    .setAudience("payoutpower-client")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<UserPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: "payoutpower-ims",
      audience: "payoutpower-client",
    });
    return payload as unknown as UserPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<UserPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}

/**
 * RBAC guard — returns the session if the user has one of the required roles,
 * or null if unauthenticated / unauthorized.
 */
export async function authenticate(requiredRoles?: string[]): Promise<UserPayload | null> {
  const session = await getSession();
  if (!session) return null;
  if (requiredRoles && !requiredRoles.includes(session.role)) return null;
  return session;
}
