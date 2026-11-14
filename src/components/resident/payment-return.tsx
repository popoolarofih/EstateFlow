"use client";

import { CheckCircle, Clock, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { LinkButton } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { api, errorMessage } from "@/lib/api/client";

type Status = "pending" | "verified" | "failed" | "flagged";

/**
 * After checkout the provider redirects here. The redirect proves nothing: this screen asks the
 * server, which confirms with the provider, and only shows success once the server says so.
 */
export function PaymentReturn({ reference }: { reference: string }) {
  const [status, setStatus] = useState<Status>("pending");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const attempts = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    async function check() {
      attempts.current += 1;
      try {
        const result = await api<{ status: Status; paymentId: string }>("/api/payments/verify", { json: { reference } });
        if (cancelled) return;
        setStatus(result.status);
        setPaymentId(result.paymentId);
        setError(null);
        if (result.status === "pending") {
          if (attempts.current < 10) timer = window.setTimeout(check, 3000 * attempts.current);
          else setExhausted(true);
        }
      } catch (caught) {
        if (cancelled) return;
        setError(errorMessage(caught));
        if (attempts.current < 5) timer = window.setTimeout(check, 4000);
      }
    }
    void check();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [reference]);

  if (status === "verified") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <CheckCircle size={56} weight="fill" className="text-teal" aria-hidden />
        <h1 className="heading-5 text-ink">Payment confirmed</h1>
        <p className="body-6 text-muted">The provider confirmed your payment and your invoice has been updated.</p>
        <div className="flex flex-wrap justify-center gap-2">
          {paymentId && <LinkButton href={`/resident/payments/receipts/${paymentId}`}>View receipt</LinkButton>}
          <LinkButton href="/resident/payments" variant="secondary">
            Back to payments
          </LinkButton>
        </div>
      </div>
    );
  }
  if (status === "failed" || status === "flagged") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <WarningCircle size={56} weight="fill" className="text-alert" aria-hidden />
        <h1 className="heading-5 text-ink">{status === "failed" ? "Payment not completed" : "Payment under review"}</h1>
        <p className="body-6 text-muted">
          {status === "failed"
            ? "The provider did not confirm this payment. No money was applied to your invoice. You can try again."
            : "The amount received did not match your invoice, so it was not applied automatically. Your estate manager has been notified."}
        </p>
        <LinkButton href="/resident/payments">Back to payments</LinkButton>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-4 text-center" role="status" aria-live="polite">
      <Clock size={56} className="text-gold-ink" aria-hidden />
      <h1 className="heading-5 text-ink">Confirming your payment</h1>
      <p className="body-6 text-muted">We are checking with the payment provider. This usually takes a few seconds.</p>
      {error && <Notice tone="warning">{error}</Notice>}
      {exhausted && (
        <p className="body-6 text-muted">Still waiting. You will get a notification as soon as it is confirmed.</p>
      )}
      <LinkButton href="/resident/payments" variant="secondary">
        Back to payments
      </LinkButton>
    </div>
  );
}
