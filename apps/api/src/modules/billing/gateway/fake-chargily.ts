// A simulated Chargily Pay API (dev / tests, PAYMENT_DRIVER=fake). It answers the two calls `ChargilyGateway` makes
// (`POST /checkouts`, `GET /checkouts/:id`) with the shapes of Chargily v2 and keeps its state in Redis so the API and
// the worker see the same checkouts. Its `checkout_url` points to the local tester page `/api/v1/dev-payments/:id`,
// where a person (or a test) decides paid / failed / expired / pending; `decide()` then produces the webhook exactly as
// Chargily would send it (same body, same HMAC `signature` header). No network, no real money.
import { randomUUID } from 'node:crypto';
import type Redis from 'ioredis';
import { chargilySignature, type PayRequest, type PayResponse, type PayTransport } from './chargily.gateway';

export const FAKE_CHARGILY_BASE = 'fake://chargily/api/v2';
const TTL_S = 7 * 24 * 3600;
const WINDOW_MS = 15 * 60_000;

export type FakeCheckout = {
  id: string;
  amount: number;
  currency: 'dzd';
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'canceled' | 'expired';
  description: string;
  locale: string;
  metadata: Record<string, string>;
  success_url: string;
  failure_url: string;
  webhook_endpoint: string;
  payment_method: 'cib' | 'edahabia' | null;
  failure_reason: string | null;
  checkout_url: string;
  created_at: number;
  updated_at: number;
};
export type FakeOutcome = 'paid' | 'failed' | 'expired' | 'pending';

export class FakeChargilyBackend {
  constructor(
    private readonly redis: Redis,
    private readonly o: { pageBase: string; secret: string },
  ) {}

  private key(id: string) {
    return `fakepay:co:${id}`;
  }

  async get(id: string): Promise<FakeCheckout | null> {
    const raw = await this.redis.get(this.key(id));
    return raw ? (JSON.parse(raw) as FakeCheckout) : null;
  }

  private async save(c: FakeCheckout) {
    await this.redis.set(this.key(c.id), JSON.stringify(c), 'EX', TTL_S);
  }

  /** Status as Chargily reports it: an untouched checkout expires after its 15 min window. */
  private view(c: FakeCheckout, now = Date.now()): FakeCheckout {
    if (c.status === 'pending' && now - c.created_at > WINDOW_MS) return { ...c, status: 'expired' };
    return c;
  }

  readonly transport: PayTransport = async (req: PayRequest): Promise<PayResponse> => {
    if (!req.headers.Authorization?.startsWith('Bearer ')) return { status: 401, json: { message: 'Unauthenticated.' } };
    const path = req.url.replace(FAKE_CHARGILY_BASE, '');
    if (req.method === 'POST' && path === '/checkouts') {
      const b = (req.body ?? {}) as Record<string, unknown>;
      const amount = Number(b.amount);
      if (!Number.isInteger(amount) || amount < 50) return { status: 422, json: { message: 'The amount field must be at least 50.', errors: { amount: ['min:50'] } } };
      const id = `01fake${randomUUID().replace(/-/g, '').slice(0, 20)}`;
      const now = Date.now();
      const c: FakeCheckout = {
        id,
        amount,
        currency: 'dzd',
        status: 'pending',
        description: String(b.description ?? ''),
        locale: String(b.locale ?? 'fr'),
        metadata: Object.fromEntries(Object.entries((b.metadata ?? {}) as Record<string, unknown>).map(([k, v]) => [k, String(v)])),
        success_url: String(b.success_url ?? ''),
        failure_url: String(b.failure_url ?? ''),
        webhook_endpoint: String(b.webhook_endpoint ?? ''),
        payment_method: null,
        failure_reason: null,
        checkout_url: `${this.o.pageBase}/${id}`,
        created_at: now,
        updated_at: now,
      };
      await this.save(c);
      return { status: 200, json: { ...c, entity: 'checkout', livemode: false, created_at: Math.floor(now / 1000), updated_at: Math.floor(now / 1000) } };
    }
    const m = /^\/checkouts\/([^/]+)$/.exec(path);
    if (req.method === 'GET' && m) {
      const c = await this.get(decodeURIComponent(m[1]!));
      if (!c) return { status: 404, json: { message: 'Not found' } };
      const v = this.view(c);
      return { status: 200, json: { ...v, entity: 'checkout', livemode: false, created_at: Math.floor(v.created_at / 1000), updated_at: Math.floor(v.updated_at / 1000) } };
    }
    return { status: 404, json: { message: 'Not found' } };
  };

  /**
   * The tester's choice on the fake checkout page. Returns the webhook Chargily would deliver (null for `pending`: the
   * checkout stays open, a later choice can still pay it) and where the browser goes next.
   */
  async decide(id: string, outcome: FakeOutcome, reason?: string): Promise<{ checkout: FakeCheckout; webhook: { rawBody: Buffer; signature: string } | null; redirectUrl: string } | null> {
    const c = await this.get(id);
    if (!c) return null;
    const now = Date.now();
    const status: FakeCheckout['status'] = outcome === 'paid' ? 'paid' : outcome === 'failed' ? 'failed' : outcome === 'expired' ? 'expired' : 'processing';
    const next: FakeCheckout = { ...c, status, payment_method: outcome === 'paid' ? (c.amount % 2 === 0 ? 'edahabia' : 'cib') : c.payment_method, failure_reason: outcome === 'failed' ? (reason ?? 'card_declined') : null, updated_at: now };
    await this.save(next);
    const redirectUrl = outcome === 'failed' || outcome === 'expired' ? next.failure_url || next.success_url : next.success_url;
    if (outcome === 'pending') return { checkout: next, webhook: null, redirectUrl };
    const body = {
      id: `evt_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
      entity: 'event',
      livemode: 'false',
      type: `checkout.${outcome}`,
      data: { ...next, entity: 'checkout', livemode: false, created_at: Math.floor(next.created_at / 1000), updated_at: Math.floor(now / 1000) },
      created_at: Math.floor(now / 1000),
      updated_at: Math.floor(now / 1000),
    };
    const rawBody = Buffer.from(JSON.stringify(body), 'utf8');
    return { checkout: next, webhook: { rawBody, signature: chargilySignature(this.o.secret, rawBody) }, redirectUrl };
  }

  /** Re-signs an arbitrary body (tests: replayed / tampered webhooks). */
  sign(rawBody: Buffer | string) {
    return chargilySignature(this.o.secret, rawBody);
  }
}
