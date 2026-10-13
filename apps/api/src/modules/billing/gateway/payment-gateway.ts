// 05-integrations §4 — the payment port. Chargily Pay is the only gateway (D4, R-N): `ChargilyGateway` is the only
// implementation. In development / tests it talks to a simulated Chargily API (`FakeChargilyBackend`) through the same
// transport seam, so request shapes, webhook bodies and the HMAC signature check are the real ones.
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export type CheckoutStatus = 'paid' | 'pending' | 'failed' | 'expired';
export type CheckoutInput = {
  amount: number;
  currency: 'DZD';
  /** our reference (BillingPayment / OrderPayment id) */
  orderRef: string;
  description: string;
  returnUrl: string;
  failUrl: string;
  metadata: Record<string, string>;
  expiresInMin: number;
  locale: 'fr' | 'ar' | 'en';
};
export type CheckoutCreated = { checkoutId: string; url: string; expiresAt: Date };
export type CheckoutVerified = { status: CheckoutStatus; amount: number; providerRef: string; method: 'cib' | 'edahabia' | null; raw: unknown; failureReason?: string };
export type WebhookEvent = { eventId: string; checkoutId: string; status: CheckoutStatus; amount: number; method: 'cib' | 'edahabia' | null; metadata: Record<string, string>; raw: unknown; failureReason?: string };

export interface PaymentGateway {
  readonly provider: 'chargily';
  /** `fake` = the simulated Chargily API (dev / tests), `chargily` = pay.chargily.net */
  readonly driver: 'fake' | 'chargily';
  createCheckout(input: CheckoutInput): Promise<CheckoutCreated>;
  verify(checkoutId: string): Promise<CheckoutVerified>;
  /** null = bad signature (⇒ 401 WEBHOOK_SIGNATURE_INVALID) */
  parseWebhook(headers: Record<string, string | string[] | undefined>, rawBody: Buffer): WebhookEvent | null;
  /** Chargily has no refund API (05 §4.2): refunds are recorded manually. */
  refund?: (providerRef: string, amount: number, reason: string) => Promise<{ ok: boolean; refundRef?: string }>;
}

/** Network / 5xx / 429 / timeout: the caller may retry (503 `PROVIDER_UNAVAILABLE {provider}`). */
export class PaymentProviderError extends Error {
  constructor(
    public readonly kind: 'unavailable' | 'rejected',
    message: string,
  ) {
    super(message);
  }
}
