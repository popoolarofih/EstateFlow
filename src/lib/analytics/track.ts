"use client";

import { track as vercelTrack } from "@vercel/analytics";

type Props = Record<string, string | number | boolean | null>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Records a product event (no personal data: never pass names, emails or phone numbers).
 * Goes to Vercel Analytics when enabled, and to GA4 only if the visitor accepted analytics cookies.
 */
export function track(event: string, props: Props = {}): void {
  try {
    vercelTrack(event, props);
  } catch {
    // Analytics must never break the page.
  }
  window.gtag?.("event", event, props);
}
