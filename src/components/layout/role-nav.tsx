"use client";

import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ComponentType } from "react";
import { cx } from "@/components/ui/cx";

export interface NavItem {
  href: string;
  label: string;
  icon: Icon;
  /** Matches nested routes too, except for the section root. */
  exact?: boolean;
}

function isCurrent(pathname: string | null, item: NavItem): boolean {
  if (!pathname) return false;
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

type WithPath<P> = P & { pathname: string | null };

/**
 * `usePathname` is request data for dynamic routes, so each nav renders a static version (no
 * current item) in the prerendered shell and swaps in the highlighted version on the client.
 */
export function withPathname<P extends object>(Inner: ComponentType<WithPath<P>>) {
  function Live(props: P) {
    return <Inner {...props} pathname={usePathname()} />;
  }
  return function PathAware(props: P) {
    return (
      <Suspense fallback={<Inner {...props} pathname={null} />}>
        <Live {...props} />
      </Suspense>
    );
  };
}

/** Resident bottom navigation on phones; inline tabs on larger screens. */
export const BottomNav = withPathname<{ items: NavItem[] }>(function BottomNavInner({ items, pathname }) {
  return (
    <nav
      aria-label="Main"
      className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {items.map((item) => {
          const current = isCurrent(pathname, item);
          const IconComponent = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cx(
                  "flex min-h-16 flex-col items-center justify-center gap-1 caption-4 transition duration-300 ease-weighted",
                  current ? "text-navy" : "text-muted hover:text-ink",
                )}
              >
                <IconComponent size={24} weight={current ? "fill" : "regular"} aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
});

export const TopTabs = withPathname<{ items: NavItem[] }>(function TopTabsInner({ items, pathname }) {
  return (
    <nav aria-label="Main" className="hidden md:block">
      <ul className="flex gap-1">
        {items.map((item) => {
          const current = isCurrent(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cx(
                  "inline-flex min-h-10 items-center rounded-lg px-3 py-2 button-sm transition duration-300 ease-weighted",
                  current ? "bg-navy text-white" : "text-muted hover:bg-navy/5 hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
});

export const SideNav = withPathname<{ items: NavItem[]; onNavigate?: () => void }>(function SideNavInner({
  items,
  onNavigate,
  pathname,
}) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const current = isCurrent(pathname, item);
        const IconComponent = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={current ? "page" : undefined}
              className={cx(
                "flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 button-sm transition duration-300 ease-weighted",
                current ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
              )}
            >
              <IconComponent size={20} weight={current ? "fill" : "regular"} aria-hidden />
              {item.label}
              {current && <span aria-hidden className="ml-auto size-2 rounded-full bg-teal" />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
});
