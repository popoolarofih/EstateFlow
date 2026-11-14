import { describe, expect, it, vi } from "vitest";
import { PaystackProvider } from "@/lib/payments/paystack";
import { PaymentProviderError, type ProviderTransaction } from "@/lib/payments/provider";
import { reconcileDecision } from "@/lib/payments/reconcile";
import { computePaystackSignature, verifyPaystackSignature } from "@/lib/payments/signature";

const SECRET = "sk_test_unit";

describe("Paystack webhook signature", () => {
  const body = JSON.stringify({ event: "charge.success", data: { reference: "ef_x", amount: 100 } });

  it("accepts the HMAC SHA512 of the raw body", () => {
    expect(verifyPaystackSignature(body, computePaystackSignature(body, SECRET), SECRET)).toBe(true);
  });

  it("rejects tampered bodies, other secrets, malformed and missing signatures", () => {
    const signature = computePaystackSignature(body, SECRET);
    expect(verifyPaystackSignature(body.replace("100", "999"), signature, SECRET)).toBe(false);
    expect(verifyPaystackSignature(body, computePaystackSignature(body, "other"), SECRET)).toBe(false);
    expect(verifyPaystackSignature(body, signature.slice(0, 64), SECRET)).toBe(false);
    expect(verifyPaystackSignature(body, "z".repeat(128), SECRET)).toBe(false);
    expect(verifyPaystackSignature(body, null, SECRET)).toBe(false);
    expect(verifyPaystackSignature(body, signature, "")).toBe(false);
  });

  it("is sensitive to re-serialised JSON (raw body must be used)", () => {
    const reformatted = JSON.stringify(JSON.parse(body), null, 2);
    expect(verifyPaystackSignature(reformatted, computePaystackSignature(body, SECRET), SECRET)).toBe(false);
  });
});

describe("reconcileDecision", () => {
  const payment = { status: "pending" as const, amountKobo: 5_000_000, currency: "NGN" as const, providerReference: "ef_1" };
  const tx = (overrides: Partial<ProviderTransaction> = {}): ProviderTransaction => ({
    reference: "ef_1",
    status: "success",
    amountKobo: 5_000_000,
    currency: "NGN",
    paidAt: new Date(),
    customerEmail: "a@b.ng",
    ...overrides,
  });

  it("verifies exact matches only", () => {
    expect(reconcileDecision(payment, tx())).toEqual({ outcome: "verify" });
  });

  it("is idempotent for already verified payments", () => {
    expect(reconcileDecision({ ...payment, status: "verified" }, tx())).toEqual({ outcome: "already_processed" });
  });

  it("flags amount, currency and reference mismatches", () => {
    expect(reconcileDecision(payment, tx({ amountKobo: 4_999_999 })).outcome).toBe("flag");
    expect(reconcileDecision(payment, tx({ currency: "USD" })).outcome).toBe("flag");
    expect(reconcileDecision(payment, tx({ reference: "ef_2" })).outcome).toBe("flag");
    expect(reconcileDecision({ ...payment, status: "flagged" }, tx()).outcome).toBe("flag");
  });

  it("waits on pending and fails on failed transactions", () => {
    expect(reconcileDecision(payment, tx({ status: "pending" })).outcome).toBe("wait");
    expect(reconcileDecision(payment, tx({ status: "unknown" })).outcome).toBe("wait");
    expect(reconcileDecision(payment, tx({ status: "failed" })).outcome).toBe("failed");
    expect(reconcileDecision(payment, tx({ status: "abandoned" })).outcome).toBe("failed");
  });
});

describe("PaystackProvider", () => {
  function fakeFetch(body: unknown, status = 200) {
    return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  }

  it("sends amounts in kobo with the secret key and only adds a subaccount when configured", async () => {
    const fetchImpl = fakeFetch({ status: true, data: { authorization_url: "https://checkout.paystack.com/x", reference: "ef_1" } });
    const provider = new PaystackProvider(SECRET, fetchImpl as unknown as typeof fetch);
    await provider.initialize({ email: "a@b.ng", amountKobo: 5_000_000, reference: "ef_1", callbackUrl: "http://x/return", metadata: {} });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.paystack.co/transaction/initialize");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${SECRET}`);
    const sent = JSON.parse(String(init.body));
    expect(sent).toMatchObject({ amount: 5_000_000, currency: "NGN", reference: "ef_1" });
    expect(sent.subaccount).toBeUndefined();

    await provider.initialize({
      email: "a@b.ng",
      amountKobo: 5_000_000,
      reference: "ef_1",
      callbackUrl: "http://x/return",
      metadata: {},
      subaccountCode: "ACCT_123",
      transactionChargeKobo: 100_000,
    });
    const second = JSON.parse(String((fetchImpl.mock.calls[1] as unknown as [string, RequestInit])[1].body));
    expect(second).toMatchObject({ subaccount: "ACCT_123", transaction_charge: 100_000 });
  });

  it("refuses a checkout whose reference does not match", async () => {
    const provider = new PaystackProvider(SECRET, fakeFetch({ status: true, data: { authorization_url: "https://checkout.paystack.com/x", reference: "other" } }) as unknown as typeof fetch);
    await expect(
      provider.initialize({ email: "a@b.ng", amountKobo: 1, reference: "ef_1", callbackUrl: "http://x", metadata: {} }),
    ).rejects.toBeInstanceOf(PaymentProviderError);
  });

  it("maps the verify response and treats unknown statuses as unknown", async () => {
    const provider = new PaystackProvider(
      SECRET,
      fakeFetch({ status: true, data: { reference: "ef_1", status: "success", amount: 500, currency: "NGN", paid_at: "2026-11-14T10:00:00.000Z", customer: { email: "a@b.ng" } } }) as unknown as typeof fetch,
    );
    await expect(provider.verify("ef_1")).resolves.toMatchObject({ reference: "ef_1", status: "success", amountKobo: 500 });
    const odd = new PaystackProvider(SECRET, fakeFetch({ status: true, data: { reference: "ef_1", status: "queued", amount: 500, currency: "NGN" } }) as unknown as typeof fetch);
    await expect(odd.verify("ef_1")).resolves.toMatchObject({ status: "unknown" });
  });

  it("surfaces provider errors without leaking the key", async () => {
    const provider = new PaystackProvider(SECRET, fakeFetch({ status: false, message: "Invalid key" }, 401) as unknown as typeof fetch);
    await expect(provider.verify("ef_1")).rejects.toThrow("Paystack request failed: Invalid key");
    expect(() => new PaystackProvider("")).toThrow(PaymentProviderError);
  });
});
