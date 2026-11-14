import { Suspense } from "react";
import { AdminMobileNavItems, AdminSideNavItems } from "@/components/admin/admin-nav-items";
import { HeaderStatus } from "@/components/layout/header-status";
import { Logo } from "@/components/layout/logo";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="no-print sticky top-0 hidden h-dvh flex-col gap-8 overflow-y-auto bg-navy px-3 py-6 lg:flex">
        <div className="px-3">
          <Logo href="/admin/overview" tone="light" />
        </div>
        <Suspense fallback={<div className="mx-3 h-64 animate-pulse rounded-xl bg-white/5" />}>
          <AdminSideNavItems />
        </Suspense>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 bg-navy px-4 py-2 lg:hidden">
          <Logo href="/admin/overview" tone="light" />
          <div className="flex items-center gap-1">
            <Suspense fallback={<div className="size-12" />}>
              <HeaderStatus tone="light" />
            </Suspense>
            <Suspense fallback={<div className="size-12" />}>
              <AdminMobileNavItems />
            </Suspense>
          </div>
        </header>
        <div className="no-print hidden items-center justify-end border-b border-line bg-canvas px-8 py-2 lg:flex">
          <Suspense fallback={<div className="size-12" />}>
            <HeaderStatus />
          </Suspense>
        </div>
        <main id="main" className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
