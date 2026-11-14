"use client";

import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import Link from "next/link";
import Script from "next/script";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  onOpenConsentSettings,
  openConsentSettings,
  readConsent,
  subscribeConsent,
  writeConsent,
  type ConsentState,
} from "@/lib/analytics/consent";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/**
 * Public site analytics.
 * - Vercel Web Analytics is cookieless and anonymous, so it runs without consent.
 * - Google Analytics 4 sets cookies, so it loads only after the visitor accepts, and the banner
 *   appears only when GA4 is configured (NEXT_PUBLIC_GA_MEASUREMENT_ID).
 */
export function SiteAnalytics({ vercel }: { vercel: boolean }) {
  const consent = useSyncExternalStore<ConsentState>(subscribeConsent, readConsent, () => null);
  return (
    <>
      {vercel && <VercelAnalytics />}
      {GA_ID && consent === "granted" && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config',${JSON.stringify(GA_ID)},{anonymize_ip:true});`}
          </Script>
        </>
      )}
      {GA_ID && <ConsentBanner consent={consent} />}
    </>
  );
}

function ConsentBanner({ consent }: { consent: ConsentState }) {
  const [reopened, setReopened] = useState(false);
  useEffect(() => onOpenConsentSettings(() => setReopened(true)), []);
  if (consent !== null && !reopened) return null;

  const choose = (value: "granted" | "denied") => {
    writeConsent(value);
    setReopened(false);
    if (value === "denied") {
      // Remove GA cookies that may exist from an earlier acceptance.
      for (const name of document.cookie.split(";").map((part) => part.split("=")[0]!.trim())) {
        if (name.startsWith("_ga")) document.cookie = `${name}=; Max-Age=0; path=/; domain=${location.hostname.replace(/^www\./, ".")}`;
      }
    }
  };

  return (
    <section
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-2xl flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-xl animate-rise md:flex-row md:items-center"
    >
      <p className="flex-1 body-6 text-ink">
        We use one essential cookie to keep you signed in. With your permission we also use analytics cookies to learn how
        visitors use this site. <Link href="/privacy#cookies" className="text-violet-ink underline underline-offset-4">Privacy notice</Link>
      </p>
      <div className="flex shrink-0 gap-2">
        <Button variant="secondary" size="sm" onClick={() => choose("denied")}>
          Essential only
        </Button>
        <Button variant="dark" size="sm" onClick={() => choose("granted")}>
          Accept analytics
        </Button>
      </div>
    </section>
  );
}

export function CookieSettingsLink({ className }: { className?: string }) {
  if (!GA_ID) return null;
  return (
    <button type="button" className={className} onClick={openConsentSettings}>
      Cookie settings
    </button>
  );
}
