import type { NextConfig } from "next";

// HSTS: 2 años. Solo tiene efecto sobre HTTPS (Cloud Run / Firebase Hosting).
const HSTS_MAX_AGE_SEGUNDOS = 63_072_000;

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: `max-age=${HSTS_MAX_AGE_SEGUNDOS}; includeSubDomains`,
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  // Imagen mínima para Cloud Run (ver Dockerfile).
  output: "standalone",
  poweredByHeader: false,
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
