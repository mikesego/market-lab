import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    taint: true,
  },
  serverExternalPackages: ["pg"],
  async rewrites() {
    return [{ source: "/classroom", destination: "/classroom/index.html" }];
  },
  async headers() {
    return [
      { source: "/classroom/sw.js", headers: [{ key: "Service-Worker-Allowed", value: "/classroom" }] },
      {
        source: "/classroom/:path*",
        headers: [
          { key: "Cache-Control", value: "no-cache" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
