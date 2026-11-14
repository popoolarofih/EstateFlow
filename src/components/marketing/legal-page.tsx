import type { ReactNode } from "react";
import { SiteFooter } from "./site-footer";
import { SiteNav } from "./site-nav";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="bg-surface">
      <SiteNav />
      <main id="main" className="mx-auto flex max-w-[680px] flex-col gap-6 px-4 pb-24 pt-32">
        <h1 className="heading-4 text-ink">{title}</h1>
        <p className="caption-2 text-muted">Last updated {updated}</p>
        <div className="flex flex-col gap-4 body-3 text-ink [&_h2]:mt-6 [&_h2]:heading-6 [&_li]:ml-6 [&_li]:list-disc">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
