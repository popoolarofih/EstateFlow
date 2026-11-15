import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [{ userAgent: "*", allow: ["/", "/privacy", "/terms"], disallow: ["/api/", "/resident", "/guard", "/admin", "/platform", "/join", "/notifications"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
