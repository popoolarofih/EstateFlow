"use client";

import { List as ListIcon, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/layout/logo";
import { buttonClasses } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";

const LINKS = [
  // Absolute "/#..." so the links also work from the legal pages.
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#benefits", label: "Benefits" },
  { href: "/#faq", label: "FAQ" },
  { href: "/sign-in", label: "Sign in" },
];

/**
 * Floating, content sized navigation with a translucent blurred surface. On phones the toggle
 * morphs between menu and close, and opens a full height panel whose links arrive in sequence.
 */
export function SiteNav() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <nav aria-label="Main" className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
        <div className="flex w-full max-w-3xl items-center justify-between gap-4 rounded-2xl border border-line bg-surface/75 px-3 py-2 shadow-sm backdrop-blur-lg md:w-auto">
          <Link href="/" className="flex items-center gap-2 rounded-lg" aria-label="EstateFlow home" aria-current="page">
            <LogoMark />
            <span className="title-3 text-ink">EstateFlow</span>
          </Link>
          <ul className="hidden items-center gap-1 md:flex">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="inline-flex min-h-10 items-center rounded-lg px-3 py-2 button-sm text-muted transition duration-300 ease-weighted hover:bg-navy/5 hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <Link href="/#pilot" className={buttonClasses("dark", "sm")}>
              Book a pilot
            </Link>
          </div>
          <button
            type="button"
            className="relative inline-flex size-12 items-center justify-center rounded-xl text-ink hover:bg-navy/5 md:hidden"
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            <span className={cx("absolute transition duration-500 ease-weighted", open ? "rotate-90 opacity-0" : "rotate-0 opacity-100")}>
              <ListIcon size={24} aria-hidden />
            </span>
            <span className={cx("absolute transition duration-500 ease-weighted", open ? "rotate-0 opacity-100" : "-rotate-90 opacity-0")}>
              <X size={24} aria-hidden />
            </span>
          </button>
        </div>
      </nav>
      <div
        id="site-menu"
        inert={!open}
        aria-hidden={!open}
        className={cx(
          "fixed inset-0 z-40 flex flex-col gap-2 bg-canvas/95 px-4 pb-10 pt-24 backdrop-blur-xl transition duration-500 ease-weighted md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <ul className="flex flex-col gap-1">
          {[...LINKS, { href: "/#pilot", label: "Book a pilot" }].map((link, index) => (
            <li
              key={link.href}
              className={cx("transition duration-500 ease-weighted", open ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}
              style={{ transitionDelay: open ? `${Math.min(index * 60, 400)}ms` : "0ms" }}
            >
              <Link href={link.href} onClick={() => setOpen(false)} className="flex min-h-14 items-center rounded-xl px-3 py-2 heading-6 text-ink hover:bg-navy/5">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
