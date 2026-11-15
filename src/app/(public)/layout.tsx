import { SiteAnalytics } from "@/components/analytics/analytics";

/** Public pages (landing, legal, sign in). The signed in app is never tracked. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const vercel = process.env.VERCEL === "1" || process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS === "true";
  return (
    <>
      {children}
      <SiteAnalytics vercel={vercel} />
    </>
  );
}
