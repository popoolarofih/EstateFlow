import Link from "next/link";
import { cx } from "./cx";

/** Link based tabs, so each tab is shareable and works without JavaScript. */
export function LinkTabs({ tabs, current, label }: { tabs: { key: string; label: string; href: string }[]; current: string; label: string }) {
  return (
    <nav aria-label={label} className="overflow-x-auto">
      <ul className="flex w-max gap-1 rounded-xl bg-surface p-1 border border-line">
        {tabs.map((tab) => (
          <li key={tab.key}>
            <Link
              href={tab.href}
              aria-current={tab.key === current ? "page" : undefined}
              className={cx(
                "inline-flex min-h-10 items-center rounded-lg px-3 py-2 button-sm transition duration-300 ease-weighted",
                tab.key === current ? "bg-navy text-white" : "text-muted hover:bg-canvas hover:text-ink",
              )}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
