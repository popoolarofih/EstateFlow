"use client";

/**
 * Cookie consent for non essential (analytics) cookies. The choice is stored in this browser
 * only; essential cookies (the sign in session) never need consent.
 */
export type ConsentState = "granted" | "denied" | null;

const STORAGE_KEY = "estateflow.consent.v1";
const OPEN_EVENT = "estateflow:open-consent";
const listeners = new Set<() => void>();

export function readConsent(): ConsentState {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function writeConsent(value: Exclude<ConsentState, null>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage blocked: the choice applies to this page view only.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeConsent(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Reopens the banner, e.g. from the "Cookie settings" footer link. */
export function openConsentSettings(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function onOpenConsentSettings(listener: () => void): () => void {
  window.addEventListener(OPEN_EVENT, listener);
  return () => window.removeEventListener(OPEN_EVENT, listener);
}
