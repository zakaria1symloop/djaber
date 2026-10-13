// Helpers of the M3 specs for notifications, queue, safety settings and the public data-deletion page.
// Real API of this repo (fake adapters only). A spec skips itself, with the reason, when its M3 routes are absent.
import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext, type Page, type Route } from '@playwright/test';
import { API, authHeaders, type Account } from './m1';
import { adjustStock, seedProduct, sku } from './m2';

const ready = async (request: APIRequestContext, a: Account, path: string) => {
  try {
    return (await request.get(`${API}${path}`, { headers: authHeaders(a), timeout: 5000 })).ok();
  } catch {
    return false;
  }
};
export const notificationsReady = (request: APIRequestContext, a: Account) => ready(request, a, '/notifications/unread-count');
export const conversationsReady = (request: APIRequestContext, a: Account) => ready(request, a, '/conversations/counts');
export const safetyReady = (request: APIRequestContext, a: Account) => ready(request, a, '/safety/blocks');

export async function unreadCount(request: APIRequestContext, a: Account): Promise<number> {
  const res = await request.get(`${API}/notifications/unread-count`, { headers: authHeaders(a) });
  expect(res.ok(), await res.text()).toBeTruthy();
  return ((await res.json()) as { data: { count: number } }).data.count;
}

/**
 * Produces real in-app notifications through the catalogue (M2 producers): one `stock_low` (3 left, threshold 5) and
 * one `stock_out`. They are delivered by the outbox relay: resolves with the unread count once both are stored, or
 * `null` when nothing arrives (relay not running) so that the spec can skip with that reason.
 */
export async function seedStockNotifications(request: APIRequestContext, a: Account, tag: string): Promise<{ lowName: string; outName: string; unread: number } | null> {
  const lowName = `Parfum Oud ${tag}`;
  const outName = `Sac cuir ${tag}`;
  const low = await seedProduct(request, a, { name: lowName, sku: sku('NTFL'), price: 4900, stock: 10, minStock: 5 });
  const out = await seedProduct(request, a, { name: outName, sku: sku('NTFO'), price: 9800, stock: 4, minStock: 2 });
  await adjustStock(request, a, { productId: low.id, type: 'out', quantity: 7 });
  await adjustStock(request, a, { productId: out.id, type: 'out', quantity: 4 });
  // M10: saving a product also writes the grouped `product.approved` row (MOD-10); the stock rows are awaited by family
  // and the unread count is read once both are there, so it is the server count the page will show
  const deadline = Date.now() + 20_000;
  for (;;) {
    const res = await request.get(`${API}/notifications?group=stock`, { headers: authHeaders(a) });
    const rows = res.ok() ? ((await res.json()) as { data: unknown[] }).data : [];
    if (rows.length >= 2) {
      await new Promise((r) => setTimeout(r, 1_000));
      return { lowName, outName, unread: await unreadCount(request, a) };
    }
    if (Date.now() > deadline) return null;
    await new Promise((r) => setTimeout(r, 500));
  }
}

/* ---------- contract-shaped fixtures for the states the fake adapters cannot produce on demand ---------- */
export const fulfil = (route: Route, data: unknown, meta: Record<string, unknown> = {}, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': 'http://localhost:3010', 'access-control-allow-credentials': 'true' },
    body: JSON.stringify(status < 400 ? { data, meta } : { error: data }),
  });

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
export const queueConversation = (o: { id?: string; name: string; channel?: string; preview: string; handoffReason: string | null; minutes: number; assignee?: { id: string; firstName: string; lastName: string } | null }) => ({
  id: o.id ?? randomUUID(),
  channel: { id: randomUUID(), platform: 'facebook', name: o.channel ?? 'Boutique Amel', avatarUrl: null, status: 'active' },
  client: { id: randomUUID(), name: o.name, phone: '0555123456', riskLevel: 'normal', isPlaceholder: false, blocked: false, orderCount: 1, avatarUrl: null },
  status: 'needs_human',
  aiPaused: true,
  agent: null,
  assignee: o.assignee ? { ...o.assignee, avatarUrl: null } : null,
  unreadCount: 1,
  lastMessageAt: ago(o.minutes),
  lastMessagePreview: o.preview,
  lastMessageDirection: 'in',
  lastCustomerMessageAt: ago(o.minutes),
  within24h: true,
  lastAiIntent: null,
  language: 'fr',
  handoffReason: o.handoffReason,
  blocked: false,
  cart: null,
  version: 4,
});

/** Serves the queue lists from fixtures (the PATCH of an action still goes to `onPatch`). */
export async function mockQueue(page: Page, o: { conversations: unknown[]; insights?: unknown[] | null; onPatch?: (id: string, body: Record<string, unknown>) => void }) {
  await page.route(/\/api\/v1\/conversations\/counts/, (r) => fulfil(r, { all: o.conversations.length, active: 0, needs_human: o.conversations.length, resolved: 0, archived: 0, unread: 0, blocked: 0 }));
  await page.route(/\/api\/v1\/conversations(\?.*)?$/, (r) => fulfil(r, o.conversations, { nextCursor: null, hasMore: false }));
  await page.route(/\/api\/v1\/agent-insights/, (r) =>
    o.insights === null ? fulfil(r, { code: 'NOT_FOUND', message: 'Introuvable', ref: 'e2e' }, {}, 404) : fulfil(r, o.insights ?? [], { page: 1, pageSize: 25, total: (o.insights ?? []).length }),
  );
  await page.route(/\/api\/v1\/conversations\/[0-9a-f-]{36}$/, async (r) => {
    if (r.request().method() !== 'PATCH') return r.fallback();
    const id = r.request().url().split('/').pop()!;
    const body = r.request().postDataJSON() as Record<string, unknown>;
    o.onPatch?.(id, body);
    return fulfil(r, { id, ...body });
  });
}

export const blockRow = (o: { name?: string; phone?: string | null; source: 'manual' | 'auto_rule' | 'platform'; reason?: string | null; reportStatus?: string | null }) => ({
  id: randomUUID(),
  client: o.name ? { id: randomUUID(), name: o.name, phone: o.phone ?? null, riskLevel: 'high', isPlaceholder: false, blocked: true, orderCount: 0, avatarUrl: null } : null,
  phone: o.phone ?? null,
  reason: o.reason ?? null,
  note: null,
  source: o.source,
  blockedBy: null,
  blockedAt: '2026-10-04T09:00:00.000Z',
  reportStatus: o.reportStatus ?? null,
  unblockable: o.source !== 'platform',
});

/** A phone number that is unique per run (blocks are keyed on the normalised phone). */
export const uniquePhone = () => `05${String(Date.now() % 100_000_000).padStart(8, '0')}`;
