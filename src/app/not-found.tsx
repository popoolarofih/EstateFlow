import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="px-4 py-6 md:px-8">
        <Logo />
      </header>
      <main id="main" className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-24 text-center">
        <p className="font-mono heading-2 text-navy">404</p>
        <h1 className="heading-5 text-ink">This page is not on the guest list</h1>
        <p className="max-w-md body-6 text-muted">The link may be old or mistyped. Head back and try again.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/" className={buttonClasses("dark", "md")}>
            Go to the homepage
          </Link>
          <Link href="/sign-in" className={buttonClasses("secondary", "md")}>
            Sign in
          </Link>
        </div>
      </main>
    </div>
  );
}
