import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

export function Card({ className, ...rest }: ComponentProps<"section">) {
  return <section className={cx("rounded-2xl border border-line bg-surface p-4 md:p-6", className)} {...rest} />;
}

export function CardHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="heading-6 text-ink">{title}</h2>
        {description && <p className="body-6 text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "teal" | "gold" | "alert" | "violet";
}) {
  const accent = {
    neutral: "bg-line-strong",
    teal: "bg-teal",
    gold: "bg-gold",
    alert: "bg-alert",
    violet: "bg-violet",
  }[tone];
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2">
        <span aria-hidden className={cx("size-2 rounded-full", accent)} />
        <p className="caption-1 text-muted">{label}</p>
      </div>
      <p className="heading-5 tabular-nums text-ink">{value}</p>
      {detail && <p className="caption-2 text-muted">{detail}</p>}
    </div>
  );
}
