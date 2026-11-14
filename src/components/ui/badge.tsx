import type { ReactNode } from "react";
import { cx } from "./cx";

export type Tone = "neutral" | "teal" | "gold" | "alert" | "violet" | "navy";

const TONES: Record<Tone, string> = {
  neutral: "bg-canvas text-muted border-line",
  teal: "bg-teal-soft text-teal-ink border-teal/30",
  gold: "bg-gold-soft text-gold-ink border-gold/40",
  alert: "bg-alert-soft text-alert-ink border-alert/30",
  violet: "bg-violet-soft text-violet-ink border-violet/30",
  navy: "bg-navy text-white border-navy",
};

/** Status badge. Always carries text, so colour is never the only signal. */
export function Badge({ tone = "neutral", children, icon }: { tone?: Tone; children: ReactNode; icon?: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 caption-3 whitespace-nowrap", TONES[tone])}>
      {icon}
      {children}
    </span>
  );
}
