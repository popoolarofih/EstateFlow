import { Suspense } from "react";
import { HeaderStatus } from "@/components/layout/header-status";
import { Logo } from "@/components/layout/logo";
import { ResidentBottomNav, ResidentTopTabs } from "@/components/resident/resident-nav";

export default function ResidentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh pb-24 md:pb-0">
      <header className="no-print sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-2 md:px-6">
          <Logo href="/resident" />
          <ResidentTopTabs />
          <Suspense fallback={<div className="size-12" />}>
            <HeaderStatus />
          </Suspense>
        </div>
      </header>
      <main id="main" className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        {children}
      </main>
      <ResidentBottomNav />
    </div>
  );
}
