import Link from "next/link";
import { CookieSettingsLink } from "@/components/analytics/analytics";
import { Logo } from "@/components/layout/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface px-4 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div className="flex max-w-sm flex-col gap-3">
          <Logo />
          <p className="body-6 text-muted">Visitor passes, verified dues payments and a transparent ledger for gated estates in Nigeria.</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-3">
          <Link href="/#how-it-works" className="body-6 text-muted hover:text-ink">How it works</Link>
          <Link href="/#faq" className="body-6 text-muted hover:text-ink">FAQ</Link>
          <Link href="/sign-in" className="body-6 text-muted hover:text-ink">Sign in</Link>
          <Link href="/#pilot" className="body-6 text-muted hover:text-ink">Book a pilot</Link>
          <Link href="/privacy" className="body-6 text-muted hover:text-ink">Privacy notice</Link>
          <Link href="/terms" className="body-6 text-muted hover:text-ink">Terms of use</Link>
          <CookieSettingsLink className="text-left body-6 text-muted hover:text-ink" />
        </nav>
      </div>
      <p className="mx-auto mt-8 max-w-6xl caption-2 text-subtle">EstateFlow. Built in Nigeria for Nigerian estates.</p>
    </footer>
  );
}
