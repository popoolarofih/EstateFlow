import { Suspense } from "react";
import { GuardNav } from "@/components/guard/guard-nav";
import { HeaderStatus } from "@/components/layout/header-status";
import { LogoMark } from "@/components/layout/logo";

/** Ultra simple, high contrast shell for gate devices: no finance, no dense menus. */
export default function GuardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-navy text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2">
          <LogoMark />
          <GuardNav />
          <Suspense fallback={<div className="size-12" />}>
            <HeaderStatus tone="light" />
          </Suspense>
        </div>
      </header>
      <main id="main" className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
