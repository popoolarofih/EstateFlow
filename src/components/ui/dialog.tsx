"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Accessible modal built on the native <dialog> element (focus trapping, Escape to close and
 * inert background come from the platform).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="m-auto w-[calc(100%-32px)] max-w-lg rounded-2xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-navy/50 backdrop:backdrop-blur-sm open:animate-fade"
    >
      <div className="flex max-h-[85dvh] flex-col gap-4 overflow-y-auto p-6">
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="heading-6">
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className="body-6 text-muted">
              {description}
            </p>
          )}
        </div>
        {children}
      </div>
    </dialog>
  );
}
