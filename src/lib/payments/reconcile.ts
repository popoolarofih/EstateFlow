import type { Payment } from "@/types/domain";
import type { ProviderTransaction } from "./provider";

export type ReconcileDecision =
  | { outcome: "verify" }
  | { outcome: "already_processed" }
  | { outcome: "failed"; reason: string }
  | { outcome: "flag"; reason: string }
  | { outcome: "wait"; reason: string };

/**
 * Decides what a provider confirmed transaction means for a stored payment. Amount,
 * currency and reference must match exactly; anything unexpected is flagged for a human.
 */
export function reconcileDecision(
  payment: Pick<Payment, "status" | "amountKobo" | "currency" | "providerReference">,
  transaction: ProviderTransaction,
): ReconcileDecision {
  if (payment.status === "verified") return { outcome: "already_processed" };
  if (transaction.reference !== payment.providerReference) {
    return { outcome: "flag", reason: "Provider reference does not match the payment record." };
  }
  if (transaction.status === "pending" || transaction.status === "unknown") {
    return { outcome: "wait", reason: "The provider has not confirmed this payment yet." };
  }
  if (transaction.status !== "success") {
    return { outcome: "failed", reason: `Provider reported the payment as ${transaction.status}.` };
  }
  if (transaction.currency !== payment.currency) {
    return { outcome: "flag", reason: `Currency ${transaction.currency} does not match ${payment.currency}.` };
  }
  if (transaction.amountKobo !== payment.amountKobo) {
    return {
      outcome: "flag",
      reason: `Provider amount ${transaction.amountKobo} kobo does not match expected ${payment.amountKobo} kobo.`,
    };
  }
  if (payment.status === "flagged") {
    return { outcome: "flag", reason: "Payment was previously flagged and needs manual review." };
  }
  return { outcome: "verify" };
}
