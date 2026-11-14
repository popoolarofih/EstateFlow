"use client";

import { CreditCard } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api/client";

/** Starts a Paystack hosted checkout; the browser only ever receives the checkout URL. */
export function PayButton({ invoiceId, label }: { invoiceId: string; label: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        icon={<CreditCard size={18} aria-hidden />}
        pending={pending}
        pendingLabel="Opening checkout…"
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            const { authorizationUrl } = await api<{ authorizationUrl: string }>("/api/payments/initialize", { json: { invoiceId } });
            window.location.assign(authorizationUrl);
          } catch (caught) {
            setError(errorMessage(caught));
            setPending(false);
          }
        }}
      >
        {label}
      </Button>
      {error && (
        <p role="alert" className="max-w-xs text-right caption-1 text-alert-ink">
          {error}
        </p>
      )}
    </div>
  );
}
