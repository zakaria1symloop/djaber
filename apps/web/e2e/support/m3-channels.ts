// Helpers of the M3 channels spec. Two kinds of tests:
//  - "real": this repo's API with its fake Meta adapter (META_DRIVER=fake — the OAuth "dialog" URL points straight back
//    at our own callback; nothing ever leaves the machine);
//  - "fixture": states the fake adapter cannot produce over HTTP (revoked token, Meta approval pending, page connected
//    elsewhere, plan limit swap, insights unavailable, expired sync token) are served with `page.route` in the shapes of
//    `@djaber/shared` `schemas/channels.ts`.
import { expect, type APIRequestContext, type Page, type Route } from '@playwright/test';
import { API, authHeaders, mailLink, waitForMail, type Account } from './m1';

const WEB = 'http://localhost:3010';
const CORS = { 'access-control-allow-origin': WEB, 'access-control-allow-credentials': 'true' };

/** True when the M3 channels endpoints answer (the real specs skip themselves otherwise, with the reason). */
export async function channelsReady(request: APIRequestContext, a: Account): Promise<boolean> {
  try {
    return (await request.get(`${API}/channels`, { headers: authHeaders(a), timeout: 5000 })).ok();
  } catch {
    return false;
  }
}

/** Connecting a page needs a verified e-mail (AUTH-04): follows the link of the dev mailbox (the worker sends it). */
export async function verifyEmail(request: APIRequestContext, a: Account) {
  const mail = await waitForMail(a.email, /^auth\/verify$/);
  const token = new URLSearchParams(mailLink(mail).split('?')[1]).get('token');
  const res = await request.post(`${API}/auth/verify-email`, { data: { token } });
  expect(res.ok(), await res.text()).toBeTruthy();
}

export async function listChannels(request: APIRequestContext, a: Account) {
  const res = await request.get(`${API}/channels`, { headers: authHeaders(a) });
  expect(res.ok(), await res.text()).toBeTruthy();
  return ((await res.json()) as { data: { id: string; name: string; platform: string; status: string; parentChannelId: string | null }[] }).data;
}

/* ---------- fixtures ---------- */
export const IDS = { amel: '11111111-1111-7111-8111-111111111111', cosmetics: '22222222-2222-7222-8222-222222222222', outlet: '33333333-3333-7333-8333-333333333333' };
const act = (key: string, enabled = true, reasonCode?: string, primary?: boolean) => ({ key, enabled, ...(reasonCode ? { reasonCode } : {}), ...(primary ? { primary } : {}) });
const counts = { conversations: 128, active: 12, needsHuman: 3, unread: 3, messages7d: 340, inbound7d: 210, productsInScope: 128 };
const user = { id: 'u1', firstName: 'Zakaria', lastName: 'Ait', avatarUrl: null };
const health = {
  webhookSubscribed: true,
  tokenValid: true,
  tokenCheckedAt: '2026-10-11T08:00:00.000Z',
  tokenExpiresAt: null,
  permissions: { pages_messaging: 'granted', instagram_manage_messages: 'pending' },
  lastInboundAt: '2026-10-11T10:58:00.000Z',
  lastSyncAt: '2026-10-07T08:12:00.000Z',
};
type Fixture = Record<string, unknown> & { id: string; status: string };
const base = (o: Fixture): Fixture => ({
  platform: 'facebook',
  externalId: '104912345678982',
  avatarUrl: null,
  followersCount: 12400,
  pausedReason: null,
  parentChannelId: null,
  agent: { id: 'a1', name: 'Vendeur Pro', status: 'active' },
  icebreaker: null,
  counts,
  health,
  connectedAt: '2026-08-12T09:00:00.000Z',
  connectedBy: user,
  ...o,
});
const active = [act('reconnect'), act('pause'), act('resume', false, 'CONFLICT'), act('syncInfo'), act('syncHistory'), act('disconnect')];
const inactive = (resumeCode: string) => [act('reconnect'), act('pause', false, 'REPLY_CHANNEL_INACTIVE'), act('resume', false, resumeCode), act('syncInfo'), act('syncHistory', false, 'REPLY_CHANNEL_INACTIVE'), act('disconnect')];

/** The three pages of the CHN-06 frame; `planExpired` = GLOBAL "Plan expired": the Instagram page is paused by the plan. */
export const fixtureChannels = (o: { planExpired?: boolean } = {}): Fixture[] => [
  base({ id: IDS.amel, name: 'Boutique Amel', status: 'active', actions: active }),
  base({
    id: IDS.cosmetics,
    name: 'Amel Cosmétiques',
    platform: 'instagram',
    status: o.planExpired ? 'paused' : 'pending_review',
    pausedReason: o.planExpired ? 'plan' : null,
    actions: inactive(o.planExpired ? 'PLAN_LIMIT' : 'CONFLICT'),
  }),
  base({
    id: IDS.outlet,
    name: 'Amel Outlet',
    status: 'needs_reconnect',
    agent: null,
    connectedAt: '2026-09-03T09:00:00.000Z',
    health: { ...health, tokenValid: false, tokenCheckedAt: '2026-10-06T09:00:00.000Z' },
    actions: [act('reconnect', true, undefined, true), act('pause', false, 'REPLY_CHANNEL_INACTIVE'), act('resume', false, 'CONFLICT'), act('syncInfo', false, 'PAGE_TOKEN_EXPIRED'), act('syncHistory', false, 'REPLY_CHANNEL_INACTIVE'), act('disconnect')],
  }),
];

const reportPage = (externalId: string, name: string, status: string, code: string | null, platform = 'facebook') => ({ externalId, name, platform, avatarUrl: null, status, code, channelId: status === 'skipped' ? null : IDS.amel, reconnected: false });
/** DLG "Rapport de connexion": every row kind (AT-CHN-02, AT-CHN-03, AT-CHN-07, AT-CHN-08). */
export const fixtureReport = {
  id: '99999999-9999-7999-8999-999999999999',
  platform: 'facebook',
  outcome: 'ok',
  error: null,
  planLimit: { limit: 2, current: 2 },
  pages: [
    reportPage('1', 'Boutique Amel', 'connected', null),
    reportPage('2', '@amel.store', 'pending_review', 'PAGE_INSTAGRAM_PENDING_APPROVAL', 'instagram'),
    reportPage('3', 'Amel Outlet', 'skipped', 'PAGE_ALREADY_CONNECTED_ELSEWHERE'),
    reportPage('4', 'Amel Déco', 'skipped', 'PAGE_MESSAGING_PERMISSION_MISSING'),
    reportPage('5', 'Amel Kids', 'skipped', 'PLAN_LIMIT'),
    reportPage('6', 'Amel Pro', 'warning', 'PAGE_WEBHOOK_SUBSCRIBE_FAILED'),
  ],
};

const fulfil = (route: Route, data: unknown, meta: Record<string, unknown> = {}, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify({ data, meta }) });
const fail = (route: Route, status: number, code: string, message: string, params: Record<string, unknown> = {}) =>
  route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify({ error: { code, message, params, ref: 'req_e2e' } }) });

export type ChannelsMock = {
  channels: Fixture[];
  planLimit?: { limit: number; current: number };
  instagramApproved?: boolean;
  /** `GET /channels/:id/insights` answers 422 INBOX_INSIGHTS_UNAVAILABLE */
  insightsUnavailable?: boolean;
  /** `POST /channels/:id/sync` answers 401 PAGE_SYNC_TOKEN_EXPIRED */
  syncTokenExpired?: boolean;
  /** every write, in order (`PATCH /channels/<id> {…}`) */
  writes: string[];
};

/** Serves `/channels*` (and the conversations of a page) from fixtures. Writes are recorded and applied to the fixtures. */
export async function mockChannels(page: Page, m: ChannelsMock) {
  await page.route(/\/api\/v1\/(channels|conversations)(\/|\?|$)/, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...CORS, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const path = new URL(req.url()).pathname.replace('/api/v1', '');
    const method = req.method();
    if (method !== 'GET') m.writes.push(`${method} ${path} ${req.postData() ?? ''}`.trim());
    const limit = m.planLimit ?? { limit: 3, current: 3 };
    if (path === '/channels') return fulfil(route, m.channels, { planLimit: limit });
    if (path === '/channels/app-review-status') {
      return fulfil(route, {
        approved: false,
        instagramApproved: m.instagramApproved ?? false,
        humanAgentApproved: true,
        permissions: [
          { scope: 'instagram_manage_messages', feature: 'Messages Instagram', status: 'in_review', submittedAt: '2026-10-01T00:00:00.000Z', decidedAt: null },
          { scope: 'pages_messaging', feature: 'Messages de la page', status: 'approved', submittedAt: null, decidedAt: null },
        ],
      });
    }
    if (path.startsWith('/channels/connect/reports/')) return fulfil(route, fixtureReport);
    if (path === '/conversations') return fulfil(route, [], { nextCursor: null, hasMore: false });
    const match = /^\/channels\/([0-9a-f-]{36})(\/.*)?$/.exec(path);
    const c = match ? m.channels.find((x) => x.id === match[1]) : undefined;
    if (!match || !c) return fail(route, 404, 'NOT_FOUND', 'Introuvable');
    const sub = match[2] ?? '';
    if (method === 'PATCH' && !sub) {
      const body = JSON.parse(req.postData() ?? '{}') as { status?: string; swapWithChannelId?: string };
      if (body.status === 'active' && c.pausedReason === 'plan' && !body.swapWithChannelId) return fail(route, 403, 'PLAN_LIMIT', 'Limite du plan atteinte (3/3 pages).', { resource: 'pages', limit: limit.limit, current: limit.current });
      const swapped = m.channels.find((x) => x.id === body.swapWithChannelId);
      if (swapped) Object.assign(swapped, { status: 'paused', pausedReason: 'plan', actions: inactive('PLAN_LIMIT') });
      Object.assign(c, body.status === 'active' ? { status: 'active', pausedReason: null, actions: active } : { status: 'paused', pausedReason: 'manual', actions: inactive('CONFLICT').map((a) => (a.key === 'resume' ? act('resume') : a)) });
      return fulfil(route, c);
    }
    if (method === 'DELETE' && !sub) {
      Object.assign(c, { status: 'disconnected', agent: null, actions: [act('reconnect', true, undefined, true)] });
      return route.fulfill({ status: 204, headers: CORS });
    }
    if (method === 'POST' && sub === '/sync') return m.syncTokenExpired ? fail(route, 401, 'PAGE_SYNC_TOKEN_EXPIRED', 'Synchronisation impossible : page à reconnecter.') : fulfil(route, { jobId: '77777777-7777-7777-8777-777777777777' }, {}, 202);
    if (method !== 'GET') return fail(route, 404, 'NOT_FOUND', 'Introuvable');
    if (!sub) return fulfil(route, c);
    if (sub === '/summary') return fulfil(route, { counts, agent: c.agent ? { ...(c.agent as object), productsInScope: 128 } : null, health: c.health, children: [], lastHistorySyncJobId: null });
    if (sub === '/insights') {
      return m.insightsUnavailable
        ? fail(route, 422, 'INBOX_INSIGHTS_UNAVAILABLE', 'Statistiques Meta indisponibles.')
        : fulfil(route, { fetchedAt: '2026-10-11T10:00:00.000Z', period: 'day', metrics: [{ key: 'page_fans', value: 12480 }] });
    }
    if (sub === '/events') {
      return fulfil(route, [{ id: 'e1', kind: 'connected', description: null, actorType: 'user', actor: user, at: '2026-08-12T09:02:00.000Z' }], { nextCursor: null, hasMore: false });
    }
    if (sub === '/approval-status') return fulfil(route, { channelId: c.id, status: c.status, pending: c.status === 'pending_review', code: c.status === 'pending_review' ? 'PAGE_INSTAGRAM_PENDING_APPROVAL' : null });
    return fail(route, 404, 'NOT_FOUND', 'Introuvable');
  });
}
