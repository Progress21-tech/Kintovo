import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

// Next.js injects small inline bootstrap scripts, so scripts need 'unsafe-inline' without a
// nonce pipeline. Everything else is locked to this origin: no third-party script, frame,
// plugin or form target can be introduced, and the app cannot be framed (clickjacking).
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${isProduction ? "" : " ws: wss:"}`,
  "media-src 'self' blob:",
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "manifest-src 'self'",
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  experimental: {
    // Private uploads (deliverables, evidence, portfolio files) are posted through Server Actions.
    // Keep in step with UPLOAD_MAX_MB (default 15 MB) plus form overhead.
    serverActions: { bodySizeLimit: "16mb" },
    // Icon packages export thousands of modules from one barrel file. This rewrites
    // `import { X } from "@phosphor-icons/react"` to per-icon imports so the client
    // bundle only ships the icons actually used (the sidebar is on every workspace page).
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          ...(isProduction ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
        ],
      },
      {
        // Static brand assets never change between deploys; let browsers and CDNs keep them.
        source: "/brand/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
};

export default nextConfig;
