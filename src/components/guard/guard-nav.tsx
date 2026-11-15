"use client";

import { ClockCounterClockwise, Numpad, UserCircle } from "@/components/ui/icons";
import Link from "next/link";
import { withPathname } from "@/components/layout/role-nav";
import { cx } from "@/components/ui/cx";

const ITEMS = [
  { href: "/guard/verify", label: "Verify", icon: Numpad },
  { href: "/guard/activity", label: "Activity", icon: ClockCounterClockwise },
  { href: "/guard/profile", label: "Account", icon: UserCircle },
];

export const GuardNav = withPathname<object>(function GuardNavInner({ pathname }) {
  return (
    <nav aria-label="Gate" className="flex gap-1">
      {ITEMS.map((item) => {
        const current = pathname?.startsWith(item.href) ?? false;
        const IconComponent = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={cx(
              "inline-flex min-h-12 items-center gap-2 rounded-xl px-3 py-2 button-sm transition duration-300 ease-weighted",
              current ? "bg-white text-navy" : "text-white/80 hover:bg-white/10",
            )}
          >
            <IconComponent size={20} aria-hidden />
            <span className="hidden sm:inline">{item.label}</span>
            <span className="sr-only sm:hidden">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
});
