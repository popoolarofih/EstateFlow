import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return {
    rules: [{ userAgent: "*", allow: ["/", "/privacy", "/terms"], disallow: ["/api/", "/resident", "/guard", "/admin", "/platform", "/join", "/notifications"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
