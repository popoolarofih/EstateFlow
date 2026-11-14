"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { reportClientError } from "@/lib/monitoring/client";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error);
  }, [error]);
  return (
    <main id="main" className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="heading-5 text-ink">This page could not load</h1>
      <p className="body-6 text-muted">
        Something went wrong on our side. Try again, and if it keeps happening contact your estate manager
        {error.digest ? ` with reference ${error.digest}` : ""}.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Link href="/sign-in" className={buttonClasses("secondary", "md")}>
          Go to my home screen
        </Link>
      </div>
    </main>
  );
}
