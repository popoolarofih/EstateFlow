import type { ComponentProps } from "react";
import { cx } from "./cx";

/** Horizontally scrollable on small screens so the page itself never overflows. */
export function Table({ className, ...rest }: ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className={cx("w-full min-w-[640px] border-collapse text-left", className)} {...rest} />
    </div>
  );
}

export function Th({ className, ...rest }: ComponentProps<"th">) {
  return <th scope="col" className={cx("border-b border-line bg-canvas px-4 py-3 caption-3 text-muted", className)} {...rest} />;
}

export function Td({ className, ...rest }: ComponentProps<"td">) {
  return <td className={cx("border-b border-line px-4 py-3 body-6 text-ink align-top", className)} {...rest} />;
}
