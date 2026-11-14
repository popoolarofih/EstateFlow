import { z } from "zod";
import {
  PaymentProviderError,
  type InitializePaymentInput,
  type InitializePaymentResult,
  type PaymentProvider,
  type ProviderTransaction,
} from "./provider";

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const TIMEOUT_MS = 15_000;

const initializeResponse = z.object({
  status: z.boolean(),
  message: z.string().optional(),
  data: z.object({ authorization_url: z.url(), reference: z.string() }).optional(),
});

const verifyResponse = z.object({
  status: z.boolean(),
  message: z.string().optional(),
  data: z
    .object({
      reference: z.string(),
      status: z.string(),
      amount: z.number().int(),
      currency: z.string(),
      paid_at: z.string().nullable().optional(),
      customer: z.object({ email: z.string().nullable().optional() }).partial().optional(),
    })
    .optional(),
});

const KNOWN_STATUSES = new Set(["success", "failed", "abandoned", "pending", "reversed"]);

export class PaystackProvider implements PaymentProvider {
  readonly name = "paystack" as const;

  constructor(
    private readonly secretKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!secretKey) throw new PaymentProviderError("Paystack is not configured.", false);
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(`${PAYSTACK_BASE_URL}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          "Content-Type": "application/json",
          ...init.headers,
        },
        cache: "no-store",
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          body && typeof body === "object" && "message" in body ? String(body.message) : `HTTP ${response.status}`;
        throw new PaymentProviderError(`Paystack request failed: ${message}`, response.status >= 500);
      }
      return body;
    } catch (error) {
      if (error instanceof PaymentProviderError) throw error;
      throw new PaymentProviderError("Could not reach Paystack. Try again shortly.", true);
    } finally {
      clearTimeout(timer);
    }
  }

  async initialize(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const payload: Record<string, unknown> = {
      email: input.email,
      amount: input.amountKobo,
      currency: "NGN",
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    };
    if (input.subaccountCode) {
      payload.subaccount = input.subaccountCode;
      if (input.transactionChargeKobo) payload.transaction_charge = input.transactionChargeKobo;
    }
    const parsed = initializeResponse.safeParse(
      await this.request("/transaction/initialize", { method: "POST", body: JSON.stringify(payload) }),
    );
    if (!parsed.success || !parsed.data.status || !parsed.data.data) {
      throw new PaymentProviderError("Paystack did not return a checkout link.", true);
    }
    if (parsed.data.data.reference !== input.reference) {
      throw new PaymentProviderError("Paystack returned a mismatched reference.", false);
    }
    return { authorizationUrl: parsed.data.data.authorization_url, reference: parsed.data.data.reference };
  }

  async verify(reference: string): Promise<ProviderTransaction> {
    const parsed = verifyResponse.safeParse(
      await this.request(`/transaction/verify/${encodeURIComponent(reference)}`, { method: "GET" }),
    );
    if (!parsed.success || !parsed.data.status || !parsed.data.data) {
      throw new PaymentProviderError("Paystack verification response was not understood.", true);
    }
    const data = parsed.data.data;
    return {
      reference: data.reference,
      status: KNOWN_STATUSES.has(data.status) ? (data.status as ProviderTransaction["status"]) : "unknown",
      amountKobo: data.amount,
      currency: data.currency,
      paidAt: data.paid_at ? new Date(data.paid_at) : null,
      customerEmail: data.customer?.email ?? null,
    };
  }
}

/** Minimal shape of the Paystack `charge.success` webhook we rely on. */
export const paystackWebhookSchema = z.object({
  event: z.string(),
  data: z
    .object({
      reference: z.string().min(1).max(100),
      status: z.string(),
      amount: z.number().int(),
      currency: z.string(),
      paid_at: z.string().nullable().optional(),
      customer: z.object({ email: z.string().nullable().optional() }).partial().optional(),
    })
    .passthrough(),
});

export type PaystackWebhook = z.infer<typeof paystackWebhookSchema>;
