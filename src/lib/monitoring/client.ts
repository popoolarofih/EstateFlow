"use client";

/** Sends a browser crash report without blocking the UI. Never includes personal data. */
export function reportClientError(error: Error & { digest?: string }): void {
  try {
    const body = JSON.stringify({ message: error.message || "Unknown error", digest: error.digest ?? null, path: window.location.pathname });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/client-errors", new Blob([body], { type: "application/json" }));
    else void fetch("/api/client-errors", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
  } catch {
    // Reporting must never throw.
  }
}
