import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Camera is needed by the guard QR scanner on the same origin only.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  serverExternalPackages: ["firebase-admin"],
  // Files read with fs at request time are invisible to output file tracing; include them so the
  // deployed functions have them (the social images load their font from disk).
  outputFileTracingIncludes: {
    "/opengraph-image": ["./src/app/fonts/manrope-latin-700-normal.woff"],
    "/twitter-image": ["./src/app/fonts/manrope-latin-700-normal.woff"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
