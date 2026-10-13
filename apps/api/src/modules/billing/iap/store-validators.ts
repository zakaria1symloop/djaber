// 05-integrations §5 — store in-app purchase validation (D40 / D74). One port, two drivers:
//   `stores` — Google Play Developer API + App Store Server API (google-play.validator.ts, app-store.validator.ts)
//   `fake`   — sandbox-shaped answers computed locally (fake-stores.ts); no network
// SAFETY: `IAP_DRIVER=stores` is refused in development / test unless `IAP_ALLOW_LIVE=true`. Tests always fake.
import { timingSafeEqual } from 'node:crypto';

export const STORE_VALIDATORS = Symbol('STORE_VALIDATORS');

export type StorePlatform = 'google_play' | 'app_store';
export type StoreReceipt = { productId: string; transactionId: string; receipt?: string; purchaseToken?: string };
/** `valid` = the store confirms a purchased, unconsumed / unrevoked consumable of that product. */
export type StoreVerdict = { state: 'valid' | 'invalid' | 'pending'; productId: string | null; orderId: string | null; transactionId: string | null; environment: string | null; raw: unknown };
/** A store server notification after its signature check. `refund` = voided (Google) / REFUND · REVOKE (Apple). */
export type StoreNotification = { platform: StorePlatform; externalId: string; kind: 'refund' | 'test' | 'other'; transactionId: string | null; orderId: string | null; purchaseToken: string | null; raw: unknown };
export type NotificationRequest = { headers: Record<string, string | string[] | undefined>; query: Record<string, unknown>; rawBody: Buffer };

/** The store API is down / timed out (⇒ 503 IAP_STORE_UNAVAILABLE, purchase kept pending and polled later). */
export class StoreUnavailableError extends Error {}

export interface StoreValidators {
  readonly driver: 'fake' | 'stores';
  validate(platform: StorePlatform, r: StoreReceipt): Promise<StoreVerdict>;
  /** After crediting: Google `:consume` (consumables), nothing for Apple (finished by the app). Best effort. */
  acknowledge(platform: StorePlatform, r: StoreReceipt): Promise<void>;
  /** null = signature / token refused (⇒ 401 WEBHOOK_SIGNATURE_INVALID). */
  parseNotification(platform: StorePlatform, req: NotificationRequest): Promise<StoreNotification | null>;
}

/** Google Pub/Sub push envelope → the developer notification (shared by both drivers). */
export const parsePubSub = (rawBody: Buffer): { messageId: string; notification: Record<string, unknown> } | null => {
  try {
    const body = JSON.parse(rawBody.toString('utf8')) as { message?: { data?: string; messageId?: string; message_id?: string } };
    const data = body.message?.data;
    const messageId = body.message?.messageId ?? body.message?.message_id;
    if (!data || !messageId) return null;
    return { messageId, notification: JSON.parse(Buffer.from(data, 'base64').toString('utf8')) as Record<string, unknown> };
  } catch {
    return null;
  }
};

/** RTDN developer notification → StoreNotification (voidedPurchaseNotification = refund / chargeback). */
export const googleNotification = (messageId: string, n: Record<string, unknown>): StoreNotification => {
  const voided = n.voidedPurchaseNotification as { purchaseToken?: string; orderId?: string } | undefined;
  if (voided) return { platform: 'google_play', externalId: `gp:${messageId}`, kind: 'refund', transactionId: voided.orderId ?? null, orderId: voided.orderId ?? null, purchaseToken: voided.purchaseToken ?? null, raw: n };
  if (n.testNotification) return { platform: 'google_play', externalId: `gp:${messageId}`, kind: 'test', transactionId: null, orderId: null, purchaseToken: null, raw: n };
  return { platform: 'google_play', externalId: `gp:${messageId}`, kind: 'other', transactionId: null, orderId: null, purchaseToken: null, raw: n };
};

export const constantEq = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
