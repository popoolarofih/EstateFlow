import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

export const controlClasses =
  "w-full min-h-12 rounded-xl border border-line-strong bg-surface px-3 py-2 body-3 text-ink placeholder:text-subtle " +
  "transition duration-300 ease-weighted hover:border-subtle focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/25 " +
  "disabled:bg-canvas disabled:text-subtle aria-[invalid=true]:border-alert-ink";

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  optional?: boolean;
}

export function Field({ id, label, hint, error, optional, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="title-4 text-ink">
        {label}
        {optional && <span className="caption-2 text-subtle"> (optional)</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="caption-2 text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="caption-1 text-alert-ink">
          {error}
        </p>
      )}
    </div>
  );
}

export function describedBy(id: string, hint?: string, error?: string): string | undefined {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cx(controlClasses, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={cx(controlClasses, "min-h-24", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: ComponentProps<"select">) {
  return (
    <select className={cx(controlClasses, "appearance-auto", className)} {...rest}>
      {children}
    </select>
  );
}
