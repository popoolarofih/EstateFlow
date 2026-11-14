import Link from "next/link";
import { cx } from "@/components/ui/cx";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cx("size-8", className)}>
      <rect width="32" height="32" rx="8" fill="#101B35" />
      <path d="M9 22V12.5L16 8l7 4.5V22h-4.5v-5h-5v5H9Z" fill="#11B8A6" />
      <circle cx="22.5" cy="21.5" r="3.5" fill="#F3B64B" />
    </svg>
  );
}

export function Logo({ href = "/", tone = "dark" }: { href?: string; tone?: "dark" | "light" }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-lg" aria-label="EstateFlow home">
      <LogoMark />
      <span className={cx("title-2", tone === "dark" ? "text-ink" : "text-white")}>EstateFlow</span>
    </Link>
  );
}
