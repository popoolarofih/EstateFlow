/**
 * Payment provider abstraction. Paystack is implemented first; Monnify or others can be added
 * behind the same interface without touching the billing domain.
 */

export interface InitializePaymentInput {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, string>;
  /** Only sent when the estate settlement arrangement has been approved. */
  subaccountCode?: string | null;
  transactionChargeKobo?: number | null;
}

export interface InitializePaymentResult {
  authorizationUrl: string;
  reference: string;
}

export interface ProviderTransaction {
  reference: string;
  status: "success" | "failed" | "abandoned" | "pending" | "reversed" | "unknown";
  amountKobo: number;
  currency: string;
  paidAt: Date | null;
  customerEmail: string | null;
}

export interface PaymentProvider {
  readonly name: "paystack";
  initialize(input: InitializePaymentInput): Promise<InitializePaymentResult>;
  verify(reference: string): Promise<ProviderTransaction>;
}

export class PaymentProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
