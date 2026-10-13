// 05-integrations §5 — the live store validators (IAP_DRIVER=stores; never used by tests or checks with real network).
//   Google Play: service-account OAuth (RS256 JWT → https://oauth2.googleapis.com/token), then
//     GET  androidpublisher/v3/applications/{pkg}/purchases/products/{productId}/tokens/{purchaseToken}
//          purchaseState 0 = purchased, 1 = cancelled, 2 = pending; consumptionState 0 = not consumed ⇒ creditable
//     POST …/tokens/{purchaseToken}:consume after crediting
//   App Store: App Store Server API (ES256 JWT, aud appstoreconnect-v1, bid) GET /inApps/v1/transactions/{transactionId}
//     → signedTransactionInfo (x5c-verified JWS): productId, bundleId, revocationDate == null ⇒ creditable
//   Notifications: Google RTDN through a Pub/Sub push (`?token=GOOGLE_PLAY_PUBSUB_TOKEN`), App Store Server
//     Notifications v2 (`signedPayload`, x5c-verified; REFUND / REVOKE).
// The HTTP transport is injected so the contract tests replay recorded sandbox answers without network.
import { createPrivateKey } from 'node:crypto';
import { SignJWT } from 'jose';
import type { AppConfig } from '../../../core/config/config.schema';
import type { PayTransport } from '../gateway/chargily.gateway';
import { PaymentProviderError } from '../gateway/payment-gateway';
import { peekJws, verifyAppleJws } from './apple-jws';
import { constantEq, googleNotification, parsePubSub, StoreUnavailableError, type NotificationRequest, type StoreNotification, type StorePlatform, type StoreReceipt, type StoreValidators, type StoreVerdict } from './store-validators';

type StoreEnv = Pick<AppConfig, 'GOOGLE_PLAY_SERVICE_ACCOUNT' | 'GOOGLE_PLAY_PACKAGE_NAME' | 'GOOGLE_PLAY_PUBSUB_TOKEN' | 'APPLE_IAP_KEY_ID' | 'APPLE_IAP_ISSUER_ID' | 'APPLE_IAP_PRIVATE_KEY' | 'APPLE_IAP_BUNDLE_ID' | 'APPLE_IAP_ENV' | 'APPLE_ROOT_CA_SHA256'>;
type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };

const call = async (transport: PayTransport, req: Parameters<PayTransport>[0]) => {
  try {
    return await transport(req);
  } catch (e) {
    if (e instanceof PaymentProviderError) throw new StoreUnavailableError(e.message);
    throw e;
  }
};

export class LiveStoreValidators implements StoreValidators {
  readonly driver = 'stores' as const;
  private googleToken: { value: string; exp: number } | null = null;

  constructor(
    private readonly env: StoreEnv,
    private readonly transport: PayTransport,
  ) {}

  // --- Google Play -----------------------------------------------------------------------------------------------------------
  private account(): ServiceAccount {
    const raw = this.env.GOOGLE_PLAY_SERVICE_ACCOUNT ?? '';
    const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const a = JSON.parse(json) as ServiceAccount;
    if (!a.client_email || !a.private_key) throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT is incomplete');
    return a;
  }

  private async accessToken(): Promise<string> {
    if (this.googleToken && this.googleToken.exp > Date.now() + 60_000) return this.googleToken.value;
    const a = this.account();
    const tokenUri = a.token_uri ?? 'https://oauth2.googleapis.com/token';
    const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/androidpublisher' })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(a.client_email)
      .setAudience(tokenUri)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(createPrivateKey(a.private_key));
    const res = await call(this.transport, { method: 'POST', url: tokenUri, headers: { 'Content-Type': 'application/json' }, body: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion } });
    const j = (res.json ?? {}) as { access_token?: string; expires_in?: number };
    if (res.status >= 500 || res.status === 429) throw new StoreUnavailableError(`google token: HTTP ${res.status}`);
    if (!j.access_token) throw new StoreUnavailableError('google token refused');
    this.googleToken = { value: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
    return j.access_token;
  }

  private productUrl(r: StoreReceipt) {
    return `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(this.env.GOOGLE_PLAY_PACKAGE_NAME)}/purchases/products/${encodeURIComponent(r.productId)}/tokens/${encodeURIComponent(r.purchaseToken ?? '')}`;
  }

  private async google(r: StoreReceipt): Promise<StoreVerdict> {
    if (!r.purchaseToken) return { state: 'invalid', productId: null, orderId: null, transactionId: null, environment: null, raw: null };
    const token = await this.accessToken();
    const res = await call(this.transport, { method: 'GET', url: this.productUrl(r), headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 429 || res.status >= 500) throw new StoreUnavailableError(`google purchase: HTTP ${res.status}`);
    const j = (res.json ?? {}) as { purchaseState?: number; consumptionState?: number; orderId?: string; productId?: string; purchaseType?: number };
    if (res.status >= 400) return { state: 'invalid', productId: null, orderId: null, transactionId: null, environment: null, raw: j };
    const environment = j.purchaseType === 0 ? 'Sandbox' : 'Production';
    const base = { productId: j.productId ?? r.productId, orderId: j.orderId ?? null, transactionId: j.orderId ?? null, environment, raw: j };
    if (j.productId && j.productId !== r.productId) return { state: 'invalid', ...base };
    if (j.purchaseState === 2) return { state: 'pending', ...base };
    if (j.purchaseState !== 0 || j.consumptionState !== 0) return { state: 'invalid', ...base };
    // the app sends the order id as `transactionId`; a mismatch means the token belongs to another purchase
    if (j.orderId && r.transactionId && j.orderId !== r.transactionId) return { state: 'invalid', ...base };
    return { state: 'valid', ...base };
  }

  // --- App Store -------------------------------------------------------------------------------------------------------------
  private async appleJwt() {
    if (!this.env.APPLE_IAP_KEY_ID || !this.env.APPLE_IAP_ISSUER_ID || !this.env.APPLE_IAP_PRIVATE_KEY) throw new Error('APPLE_IAP_* keys are missing');
    return new SignJWT({ bid: this.env.APPLE_IAP_BUNDLE_ID })
      .setProtectedHeader({ alg: 'ES256', kid: this.env.APPLE_IAP_KEY_ID, typ: 'JWT' })
      .setIssuer(this.env.APPLE_IAP_ISSUER_ID)
      .setAudience('appstoreconnect-v1')
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(createPrivateKey(this.env.APPLE_IAP_PRIVATE_KEY.replace(/\\n/g, '\n')));
  }

  private async apple(r: StoreReceipt): Promise<StoreVerdict> {
    const base = this.env.APPLE_IAP_ENV === 'production' ? 'https://api.storekit.itunes.apple.com' : 'https://api.storekit-sandbox.itunes.apple.com';
    const res = await call(this.transport, { method: 'GET', url: `${base}/inApps/v1/transactions/${encodeURIComponent(r.transactionId)}`, headers: { Authorization: `Bearer ${await this.appleJwt()}` } });
    if (res.status === 429 || res.status >= 500) throw new StoreUnavailableError(`app store: HTTP ${res.status}`);
    const signed = (res.json as { signedTransactionInfo?: string } | null)?.signedTransactionInfo ?? (res.status >= 400 ? null : r.receipt);
    return this.appleTransaction(signed ?? '', r);
  }

  /** Shared by the API answer and the receipt the app posts (both are signed transactions). */
  async appleTransaction(signed: string, r: StoreReceipt): Promise<StoreVerdict> {
    const p = signed ? await verifyAppleJws(signed, this.env.APPLE_ROOT_CA_SHA256) : null;
    if (!p) return { state: 'invalid', productId: null, orderId: null, transactionId: null, environment: null, raw: null };
    const base = { productId: String(p.productId ?? ''), orderId: String(p.originalTransactionId ?? p.transactionId ?? ''), transactionId: String(p.transactionId ?? ''), environment: String(p.environment ?? ''), raw: p };
    if (p.bundleId !== this.env.APPLE_IAP_BUNDLE_ID || p.productId !== r.productId || String(p.transactionId) !== r.transactionId || p.revocationDate) return { state: 'invalid', ...base };
    return { state: 'valid', ...base };
  }

  // --- port ------------------------------------------------------------------------------------------------------------------
  validate(platform: StorePlatform, r: StoreReceipt): Promise<StoreVerdict> {
    return platform === 'google_play' ? this.google(r) : this.apple(r);
  }

  async acknowledge(platform: StorePlatform, r: StoreReceipt): Promise<void> {
    if (platform !== 'google_play' || !r.purchaseToken) return;
    const token = await this.accessToken();
    await call(this.transport, { method: 'POST', url: `${this.productUrl(r)}:consume`, headers: { Authorization: `Bearer ${token}` } });
  }

  async parseNotification(platform: StorePlatform, req: NotificationRequest): Promise<StoreNotification | null> {
    if (platform === 'google_play') {
      const expected = this.env.GOOGLE_PLAY_PUBSUB_TOKEN;
      const given = typeof req.query.token === 'string' ? req.query.token : '';
      if (!expected || !given || !constantEq(given, expected)) return null;
      const m = parsePubSub(req.rawBody);
      return m ? googleNotification(m.messageId, m.notification) : null;
    }
    let signedPayload = '';
    try {
      signedPayload = String((JSON.parse(req.rawBody.toString('utf8')) as { signedPayload?: unknown }).signedPayload ?? '');
    } catch {
      return null;
    }
    const p = await verifyAppleJws(signedPayload, this.env.APPLE_ROOT_CA_SHA256);
    if (!p) return null;
    return appleNotification(p, (jws) => verifyAppleJws(jws, this.env.APPLE_ROOT_CA_SHA256));
  }
}

/** App Store Server Notification v2 payload → StoreNotification (the inner transaction is verified the same way). */
export const appleNotification = async (p: Record<string, unknown>, verify: (jws: string) => Promise<Record<string, unknown> | null>): Promise<StoreNotification> => {
  const type = String(p.notificationType ?? '');
  const data = (p.data ?? {}) as { signedTransactionInfo?: string };
  const tx = data.signedTransactionInfo ? await verify(data.signedTransactionInfo) : null;
  const externalId = `as:${String(p.notificationUUID ?? peekJws(data.signedTransactionInfo ?? '')?.transactionId ?? '')}`;
  const kind = type === 'REFUND' || type === 'REVOKE' ? 'refund' : type === 'TEST' ? 'test' : 'other';
  return { platform: 'app_store', externalId, kind, transactionId: tx ? String(tx.transactionId ?? '') || null : null, orderId: tx ? String(tx.originalTransactionId ?? '') || null : null, purchaseToken: null, raw: { notificationType: type, subtype: p.subtype ?? null, transaction: tx } };
};
