"use client";

import {
  Buildings,
  ChartBar,
  CurrencyNgn,
  Gear,
  List as ListIcon,
  Notebook,
  Scroll,
  Siren,
  UserCircle,
  Wrench,
  X,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { SideNav, withPathname, type NavItem } from "@/components/layout/role-nav";
import { cx } from "@/components/ui/cx";

export const ADMIN_NAV = [
  { key: "overview", href: "/admin/overview", label: "Overview", icon: ChartBar },
  { key: "units", href: "/admin/units", label: "Units and residents", icon: Buildings },
  { key: "billing", href: "/admin/billing", label: "Billing", icon: CurrencyNgn },
  { key: "ledger", href: "/admin/ledger", label: "Ledger", icon: Notebook },
  { key: "maintenance", href: "/admin/maintenance", label: "Maintenance", icon: Wrench },
  { key: "emergencies", href: "/admin/emergencies", label: "Emergencies", icon: Siren },
  { key: "audit", href: "/admin/audit", label: "Audit log", icon: Scroll },
  { key: "settings", href: "/admin/settings", label: "Settings", icon: Gear },
  { key: "profile", href: "/admin/profile", label: "Account", icon: UserCircle },
] as const;

export type AdminNavKey = (typeof ADMIN_NAV)[number]["key"];

function itemsFor(keys: readonly AdminNavKey[]): NavItem[] {
  return ADMIN_NAV.filter((item) => keys.includes(item.key)).map(({ href, label, icon }) => ({ href, label, icon }));
}

export function AdminSideNav({ allowed }: { allowed: AdminNavKey[] }) {
  return <SideNav items={itemsFor(allowed)} />;
}

/**
 * Mobile navigation: an animated toggle that opens a full height blurred panel whose links
 * arrive one after another (60ms steps, capped at 400ms).
 */
export const AdminMobileNav = withPathname<{ allowed: AdminNavKey[]; estateName: string }>(function AdminMobileNavInner({
  allowed,
  estateName,
  pathname,
}) {
  const [open, setOpen] = useState(false);
  const items = itemsFor(allowed);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="admin-mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
        className="relative z-50 inline-flex size-12 items-center justify-center rounded-xl text-white hover:bg-white/10"
      >
        <span className={cx("absolute transition duration-500 ease-weighted", open ? "rotate-90 opacity-0" : "rotate-0 opacity-100")}>
          <ListIcon size={24} aria-hidden />
        </span>
        <span className={cx("absolute transition duration-500 ease-weighted", open ? "rotate-0 opacity-100" : "-rotate-90 opacity-0")}>
          <X size={24} aria-hidden />
        </span>
      </button>
      <div
        id="admin-mobile-nav"
        className={cx(
          "fixed inset-0 z-40 flex flex-col gap-6 bg-navy/95 px-4 pb-8 pt-20 backdrop-blur-xl transition duration-500 ease-weighted",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden={!open}
        inert={!open}
      >
        <p className="caption-1 text-white/60">{estateName}</p>
        <ul className="flex flex-col gap-1">
          {items.map((item, index) => {
            const current = pathname !== null && (pathname === item.href || pathname.startsWith(`${item.href}/`));
            const IconComponent = item.icon;
            return (
              <li
                key={item.href}
                className={cx("transition duration-500 ease-weighted", open ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}
                style={{ transitionDelay: open ? `${Math.min(index * 60, 400)}ms` : "0ms" }}
              >
                <a
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  className={cx("flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 title-1", current ? "bg-white/10 text-white" : "text-white/80")}
                >
                  <IconComponent size={24} aria-hidden /> {item.label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
});
