import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
    // Optimize image delivery
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 day cache
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  // ── Production Performance ──
  compress: true,

  // Caching headers for static assets
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-DNS-Prefetch-Control", value: "on" },
      ],
    },
    {
      source: "/:path*.(js|css|woff2|woff|ttf|ico|svg|png|jpg|jpeg|gif|webp|avif)",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=31536000, immutable",
        },
      ],
    },
    {
      source: "/api/:path*",
      headers: [
        { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ],
    },
  ],

  // Powered by header removal for security
  poweredByHeader: false,

  // Production source maps disabled for smaller bundle + security
  productionBrowserSourceMaps: false,

  // Logging configuration
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV !== "production",
    },
  },
} as NextConfig;

export default nextConfig;
