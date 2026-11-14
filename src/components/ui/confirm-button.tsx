"use client";

import { useState, type ReactNode } from "react";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { Notice } from "./feedback";

/**
 * Consequential actions always ask for confirmation and show who is acting (blueprint
 * section 4). The server writes the audit event.
 */
export function ConfirmButton({
  label,
  title,
  description,
  confirmLabel,
  variant = "secondary",
  size = "sm",
  danger = false,
  onConfirm,
  children,
  disabled,
}: {
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "dark";
  size?: "sm" | "md" | "lg";
  danger?: boolean;
  onConfirm: () => Promise<string | null | undefined | void>;
  children?: ReactNode;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)} disabled={disabled}>
        {label}
      </Button>
      <Dialog open={open} onClose={() => !pending && setOpen(false)} title={title} description={description}>
        {children}
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            pending={pending}
            onClick={async () => {
              setPending(true);
              setError(null);
              const failure = await onConfirm();
              setPending(false);
              if (failure) setError(failure);
              else setOpen(false);
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
