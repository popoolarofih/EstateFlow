import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/layout/logo";

export function AuthShell({ title, description, children, footer }: { title: string; description?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="px-4 py-6 md:px-8">
        <Logo />
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pb-16 md:items-center">
        <div className="flex w-full max-w-md flex-col gap-6 rounded-3xl border border-line bg-surface p-6 md:p-8">
          <div className="flex flex-col gap-2">
            <h1 className="heading-5 text-ink">{title}</h1>
            {description && <p className="body-6 text-muted">{description}</p>}
          </div>
          {children}
        </div>
      </main>
      <footer className="flex flex-wrap justify-center gap-4 px-4 pb-6 caption-2 text-muted">
        {footer}
        <Link href="/privacy" className="underline underline-offset-4 hover:text-ink">Privacy</Link>
        <Link href="/terms" className="underline underline-offset-4 hover:text-ink">Terms</Link>
      </footer>
    </div>
  );
}
