import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-teal text-navy hover:bg-teal/85 disabled:bg-line disabled:text-subtle",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-canvas disabled:text-subtle",
  ghost: "bg-transparent text-ink hover:bg-navy/5 disabled:text-subtle",
  danger: "bg-alert text-white hover:bg-alert-ink disabled:bg-line disabled:text-subtle",
  dark: "bg-navy text-white hover:bg-navy-soft disabled:bg-line disabled:text-subtle",
};

/* Main buttons: 8px vertical, 12px horizontal padding; 48px minimum touch target on touch devices. */
const SIZES: Record<Size, string> = {
  sm: "button-sm min-h-10 pointer-coarse:min-h-12 px-3 py-2 rounded-lg gap-2",
  md: "button-md min-h-12 px-3 py-2 rounded-xl gap-2",
  lg: "button-lg min-h-14 px-3 py-2 rounded-2xl gap-2",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cx(
    "inline-flex select-none items-center justify-center text-center whitespace-nowrap",
    "transition duration-300 ease-weighted active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  size?: Size;
  pending?: boolean;
  pendingLabel?: string;
  icon?: ReactNode;
}

export function Button({ variant, size, pending, pendingLabel, icon, className, children, disabled, type, ...rest }: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...rest}
    >
      {icon}
      <span>{pending ? (pendingLabel ?? "Working…") : children}</span>
    </button>
  );
}

interface LinkButtonProps extends ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function LinkButton({ variant, size, icon, className, children, ...rest }: LinkButtonProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...rest}>
      {icon}
      <span>{children}</span>
    </Link>
  );
}
