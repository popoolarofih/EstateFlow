import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import type { IconProps } from "./icons";
import { cx } from "./cx";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("animate-pulse rounded-lg bg-line", className)} />;
}

/** Skeleton shaped like a list of rows; used as Suspense fallbacks. */
export function ListSkeleton({ rows = 4, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
          <Skeleton className="size-10 rounded-xl" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading page" className="flex flex-col gap-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-2xl" />
        ))}
      </div>
      <ListSkeleton rows={3} />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-surface px-4 py-10 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-violet-soft text-violet" aria-hidden>
        {/* Empty states use the duotone style as a small illustration. */}
        {isValidElement(icon) ? cloneElement(icon as ReactElement<IconProps>, { size: 28, weight: "duotone" }) : icon}
      </div>
      <h3 className="title-2 text-ink">{title}</h3>
      <p className="max-w-sm body-6 text-muted">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

type NoticeTone = "info" | "success" | "warning" | "error";

const NOTICE: Record<NoticeTone, string> = {
  info: "bg-violet-soft text-violet-ink border-violet/30",
  success: "bg-teal-soft text-teal-ink border-teal/30",
  warning: "bg-gold-soft text-gold-ink border-gold/40",
  error: "bg-alert-soft text-alert-ink border-alert/30",
};

export function Notice({ tone = "info", title, children }: { tone?: NoticeTone; title?: string; children?: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("rounded-xl border px-4 py-3", NOTICE[tone])}>
      {title && <p className="body-4">{title}</p>}
      {children && <div className="body-6">{children}</div>}
    </div>
  );
}
