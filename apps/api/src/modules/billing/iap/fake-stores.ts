// Sandbox-shaped store answers for IAP_DRIVER=fake (dev, tests, the mobile app against the team server). No network.
//   Google Play: the `purchaseToken` decides — `invalid…` ⇒ cancelled purchase, `pending…` ⇒ purchaseState 2,
//     `unavailable…` ⇒ store down, anything else ⇒ purchased & unconsumed (orderId `GPA.<stable hash>`); the answer has
//     the fields of a ProductPurchase of the Developer API (purchaseType 0 = test purchase).
//   App Store: the receipt is a signed transaction like StoreKit 2's, but signed HS256 with a fixed fake key instead of the
//     Apple x5c chain (built by `fakeAppStoreTransaction`); a tampered or foreign receipt is invalid. Transaction ids
//     starting with `unavailable` simulate the store being down.
//   Notifications: Google Pub/Sub push with `?token=fake-pubsub-token`; App Store `{ signedPayload }` signed with the fake key.
import { createHash } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { appleNotification } from './live-stores';
import { constantEq, googleNotification, parsePubSub, StoreUnavailableError, type NotificationRequest, type StoreNotification, type StorePlatform, type StoreReceipt, type StoreValidators, type StoreVerdict } from './store-validators';

export const FAKE_STORE_KEY = new TextEncoder().encode('fake-app-store-signing-key-not-a-real-key');
export const FAKE_PUBSUB_TOKEN = 'fake-pubsub-token';
const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16).toUpperCase();

/** A fake StoreKit 2 signed transaction (receipt of `POST /credits/packs/iap/validate` for `app_store`). */
export const fakeAppStoreTransaction = (t: { transactionId: string; productId: string; bundleId?: string; revocationDate?: number | null; environment?: string }) =>
  new SignJWT({
    transactionId: t.transactionId,
    originalTransactionId: t.transactionId,
    productId: t.productId,
    bundleId: t.bundleId ?? 'ai.djaber.app',
    purchaseDate: Date.now(),
    signedDate: Date.now(),
    type: 'Consumable',
    inAppOwnershipType: 'PURCHASED',
    quantity: 1,
    environment: t.environment ?? 'Sandbox',
    ...(t.revocationDate ? { revocationDate: t.revocationDate, revocationReason: 0 } : {}),
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .sign(FAKE_STORE_KEY);

/** App Store Server Notification v2 body (`{ signedPayload }`) for a transaction. */
export const fakeAppStoreNotification = async (o: { type: 'REFUND' | 'REVOKE' | 'TEST' | 'CONSUMPTION_REQUEST'; transactionId: string; productId: string; uuid?: string }) => {
  const signedTransactionInfo = await fakeAppStoreTransaction({ transactionId: o.transactionId, productId: o.productId, revocationDate: o.type === 'REFUND' || o.type === 'REVOKE' ? Date.now() : null });
  const signedPayload = await new SignJWT({ notificationType: o.type, notificationUUID: o.uuid ?? `${o.type}-${o.transactionId}`, version: '2.0', signedDate: Date.now(), data: { bundleId: 'ai.djaber.app', environment: 'Sandbox', signedTransactionInfo } })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .sign(FAKE_STORE_KEY);
  return { signedPayload };
};

/** Google RTDN Pub/Sub push body. */
export const fakeGooglePubSub = (o: { messageId: string; voided?: { purchaseToken: string; orderId: string }; test?: boolean; packageName?: string }) => ({
  message: {
    messageId: o.messageId,
    publishTime: new Date().toISOString(),
    data: Buffer.from(
      JSON.stringify({
        version: '1.0',
        packageName: o.packageName ?? 'ai.djaber.app',
        eventTimeMillis: String(Date.now()),
        ...(o.voided ? { voidedPurchaseNotification: { purchaseToken: o.voided.purchaseToken, orderId: o.voided.orderId, productType: 2, refundType: 1 } } : {}),
        ...(o.test ? { testNotification: { version: '1.0' } } : {}),
      }),
    ).toString('base64'),
  },
  subscription: 'projects/djaber/subscriptions/rtdn',
});

/** Order id the fake Google store gives a purchase token. */
export const fakeGoogleOrderId = (purchaseToken: string) => `GPA.${hash(purchaseToken).slice(0, 4)}-${hash(purchaseToken).slice(4, 8)}-${hash(purchaseToken).slice(8, 12)}-${hash(purchaseToken).slice(12, 16)}`;

const verifyFake = async (jws: string): Promise<Record<string, unknown> | null> => {
  try {
    return (await jwtVerify(jws, FAKE_STORE_KEY, { algorithms: ['HS256'] })).payload as Record<string, unknown>;
  } catch {
    return null;
  }
};

export class FakeStoreValidators implements StoreValidators {
  readonly driver = 'fake' as const;
  constructor(private readonly o: { bundleId: string; pubsubToken?: string }) {}

  async validate(platform: StorePlatform, r: StoreReceipt): Promise<StoreVerdict> {
    if (platform === 'google_play') {
      const token = r.purchaseToken ?? '';
      if (token.startsWith('unavailable')) throw new StoreUnavailableError('fake google play: unavailable');
      const orderId = fakeGoogleOrderId(token);
      const purchaseState = token.startsWith('pending') ? 2 : token.startsWith('invalid') ? 1 : 0;
      const raw = { kind: 'androidpublisher#productPurchase', purchaseTimeMillis: String(Date.now()), purchaseState, consumptionState: 0, developerPayload: '', orderId, purchaseType: 0, acknowledgementState: 0, productId: r.productId, quantity: 1, regionCode: 'DZ' };
      const base = { productId: r.productId, orderId, transactionId: orderId, environment: 'Sandbox', raw };
      if (!token || purchaseState === 1) return { state: 'invalid', ...base };
      if (purchaseState === 2) return { state: 'pending', ...base };
      return { state: 'valid', ...base };
    }
    if (r.transactionId.startsWith('unavailable')) throw new StoreUnavailableError('fake app store: unavailable');
    const p = r.receipt ? await verifyFake(r.receipt) : null;
    if (!p) return { state: 'invalid', productId: null, orderId: null, transactionId: null, environment: null, raw: null };
    const base = { productId: String(p.productId ?? ''), orderId: String(p.originalTransactionId ?? ''), transactionId: String(p.transactionId ?? ''), environment: String(p.environment ?? ''), raw: p };
    if (p.bundleId !== this.o.bundleId || p.productId !== r.productId || String(p.transactionId) !== r.transactionId || p.revocationDate) return { state: 'invalid', ...base };
    return { state: 'valid', ...base };
  }

  async acknowledge(): Promise<void> {
    // the fake store has nothing to consume
  }

  async parseNotification(platform: StorePlatform, req: NotificationRequest): Promise<StoreNotification | null> {
    if (platform === 'google_play') {
      const given = typeof req.query.token === 'string' ? req.query.token : '';
      if (!given || !constantEq(given, this.o.pubsubToken || FAKE_PUBSUB_TOKEN)) return null;
      const m = parsePubSub(req.rawBody);
      return m ? googleNotification(m.messageId, m.notification) : null;
    }
    let signedPayload = '';
    try {
      signedPayload = String((JSON.parse(req.rawBody.toString('utf8')) as { signedPayload?: unknown }).signedPayload ?? '');
    } catch {
      return null;
    }
    const p = await verifyFake(signedPayload);
    return p ? appleNotification(p, verifyFake) : null;
  }
}
