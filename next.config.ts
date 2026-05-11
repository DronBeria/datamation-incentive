import type { NextConfig } from "next";

// CSP: strict but workable for Next.js + Supabase + inline styles from Tailwind
const CSP = [
  "default-src 'self'",
  // Scripts: self + Next.js inline runtime
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // Styles: self + inline (Tailwind generates inline styles)
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Fonts
  "font-src 'self' https://fonts.gstatic.com data:",
  // Images: self + Supabase storage + data URIs (charts)
  "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in",
  // Connect: self + Supabase API + Supabase Realtime
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  // Frames: nobody can embed us
  "frame-ancestors 'none'",
  // Object/embed disabled
  "object-src 'none'",
  // Base URI locked
  "base-uri 'self'",
  // Form submissions only to self
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },

  typescript: { ignoreBuildErrors: true },
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,

  logging: {
    fetches: { fullUrl: process.env.NODE_ENV !== "production" },
  },

  headers: async () => [
    // ── Security headers on every response ──────────────────────
    {
      source: "/(.*)",
      headers: [
        { key: "X-DNS-Prefetch-Control", value: "on" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        { key: "Content-Security-Policy", value: CSP },
        // HSTS: 1 year, include subdomains (only effective over HTTPS)
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
      ],
    },
    // ── Static asset caching ─────────────────────────────────────
    {
      source: "/:path*.(js|css|woff2|woff|ttf|ico|svg|png|jpg|jpeg|gif|webp|avif)",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
    // ── API: no caching + security headers ───────────────────────
    {
      source: "/api/:path*",
      headers: [
        { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ],
    },
  ],
} as NextConfig;

export default nextConfig;
