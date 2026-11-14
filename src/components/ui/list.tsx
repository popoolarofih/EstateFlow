import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";

export function List({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul aria-label={label} className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {children}
    </ul>
  );
}

export function ListRow({
  href,
  leading,
  title,
  meta,
  trailing,
}: {
  href?: string;
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
}) {
  const content = (
    <>
      {leading && (
        <div aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-canvas text-muted">
          {leading}
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="truncate title-3 text-ink">{title}</div>
        {meta && <div className="caption-2 text-muted">{meta}</div>}
      </div>
      {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
    </>
  );
  const classes = "flex min-h-16 items-center gap-3 px-4 py-3";
  return (
    <li>
      {href ? (
        <Link href={href} className={cx(classes, "transition duration-300 ease-weighted hover:bg-canvas")}>
          {content}
        </Link>
      ) : (
        <div className={classes}>{content}</div>
      )}
    </li>
  );
}
