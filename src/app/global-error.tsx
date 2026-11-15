"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/monitoring/client";
import "./globals.css";

/** Last resort boundary when the root layout itself fails. Renders its own document. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportClientError(error), [error]);
  return (
    <html lang="en-NG">
      <body className="min-h-dvh bg-canvas">
        <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="heading-5 text-ink">EstateFlow could not load</h1>
          <p className="body-6 text-muted">
            Something went wrong on our side. Try again in a moment{error.digest ? ` (reference ${error.digest})` : ""}.
          </p>
          <button type="button" onClick={reset} className="min-h-12 rounded-xl bg-teal px-3 py-2 button-md text-navy">
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
