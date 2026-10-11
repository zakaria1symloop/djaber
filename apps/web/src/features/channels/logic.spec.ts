import { describe, expect, it } from 'vitest';
import type { Channel, ConnectReport, ConnectReportPage } from './contracts';
import {
  bannerChannels,
  cardState,
  connectOutcome,
  errorReport,
  eventsQuery,
  filterByTab,
  insightValue,
  isDimmed,
  limitReached,
  listSummary,
  normalizeReport,
  parseConnectMessage,
  parseEventKinds,
  parseHistoryPeriod,
  parsePlatformTab,
  periodRange,
  permissionList,
  platformCounts,
  reportCounts,
  reportRowKind,
  shortExternalId,
  swapCandidates,
} from './logic';

const channel = (o: Partial<Channel> & { id: string }): Channel => ({
  platform: 'facebook',
  externalId: '104912345678982',
  name: `Page ${o.id}`,
  avatarUrl: null,
  followersCount: null,
  status: 'active',
  pausedReason: null,
  parentChannelId: null,
  agent: null,
  icebreaker: null,
  counts: { conversations: 0, active: 0, needsHuman: 0, unread: 0, messages7d: 0, inbound7d: 0, productsInScope: 0 },
  health: { webhookSubscribed: true, tokenValid: true, tokenCheckedAt: null, tokenExpiresAt: null, permissions: {}, lastInboundAt: null, lastSyncAt: null },
  connectedAt: '2026-08-12T09:00:00.000Z',
  connectedBy: { id: 'u1', firstName: 'Zakaria', lastName: 'Ait', avatarUrl: null },
  actions: [],
  ...o,
});
const page = (o: Partial<ConnectReportPage>): ConnectReportPage => ({ externalId: '1', name: 'Boutique Amel', platform: 'facebook', avatarUrl: null, status: 'connected', code: null, channelId: 'c1', reconnected: false, ...o });
const report = (o: Partial<ConnectReport> = {}): ConnectReport => ({ id: 'r1', platform: 'facebook', outcome: 'ok', error: null, pages: [page({})], planLimit: { limit: 3, current: 1 }, ...o });

describe('card state (CHN-06)', () => {
  it('splits `paused` by its reason and keeps the other statuses', () => {
    expect(cardState({ status: 'paused', pausedReason: 'plan' })).toBe('paused_plan');
    expect(cardState({ status: 'paused', pausedReason: 'moderation' })).toBe('paused_moderation');
    expect(cardState({ status: 'paused', pausedReason: 'manual' })).toBe('paused');
    expect(cardState({ status: 'paused', pausedReason: null })).toBe('paused');
    for (const s of ['active', 'pending_review', 'needs_reconnect', 'disabled', 'disconnected'] as const) expect(cardState({ status: s, pausedReason: null })).toBe(s);
  });
  it('greys the pages where nothing is answered, not the ones waiting for Meta or a reconnection', () => {
    expect(isDimmed({ status: 'paused', pausedReason: 'plan' })).toBe(true);
    expect(isDimmed({ status: 'disabled', pausedReason: null })).toBe(true);
    expect(isDimmed({ status: 'disconnected', pausedReason: null })).toBe(true);
    expect(isDimmed({ status: 'active', pausedReason: null })).toBe(false);
    expect(isDimmed({ status: 'pending_review', pausedReason: null })).toBe(false);
    expect(isDimmed({ status: 'needs_reconnect', pausedReason: null })).toBe(false);
  });
});

describe('platform tabs and summary', () => {
  const rows = [channel({ id: 'a' }), channel({ id: 'b', status: 'needs_reconnect' }), channel({ id: 'c', platform: 'instagram', status: 'pending_review', parentChannelId: 'a' })];
  it('reads the tab from the URL and falls back to "all"', () => {
    expect(parsePlatformTab('instagram')).toBe('instagram');
    expect(parsePlatformTab('facebook')).toBe('facebook');
    expect(parsePlatformTab('tiktok')).toBe('all');
    expect(parsePlatformTab(null)).toBe('all');
  });
  it('counts and filters by platform', () => {
    expect(platformCounts(rows)).toEqual({ all: 3, facebook: 2, instagram: 1 });
    expect(filterByTab(rows, 'instagram').map((c) => c.id)).toEqual(['c']);
    expect(filterByTab(rows, 'all')).toHaveLength(3);
  });
  it('summarises "3 pages · 1 active · 1 à reconnecter"', () => {
    expect(listSummary(rows)).toEqual({ total: 3, active: 1, reconnect: 1 });
  });
  it('knows when the plan limit is reached (-1 = unlimited)', () => {
    expect(limitReached({ limit: 3, current: 3 })).toBe(true);
    expect(limitReached({ limit: 3, current: 2 })).toBe(false);
    expect(limitReached({ limit: -1, current: 40 })).toBe(false);
    expect(limitReached(null)).toBe(false);
  });
  it('picks the pages of the shell banners', () => {
    const b = bannerChannels(rows);
    expect(b.reconnect?.id).toBe('b');
    expect(b.pending?.id).toBe('c');
    expect(bannerChannels([channel({ id: 'x' })])).toEqual({ reconnect: null, pending: null });
  });
  it('offers the other active pages for the swap, the least busy first', () => {
    const list = [
      channel({ id: 'target', status: 'paused', pausedReason: 'plan' }),
      channel({ id: 'busy', counts: { ...channel({ id: 'z' }).counts, conversations: 1010 } }),
      channel({ id: 'quiet', counts: { ...channel({ id: 'z' }).counts, conversations: 12 } }),
      channel({ id: 'off', status: 'disabled' }),
    ];
    expect(swapCandidates(list, 'target').map((c) => c.id)).toEqual(['quiet', 'busy']);
  });
});

describe('connect messages (05-integrations §1)', () => {
  const allowed = ['http://localhost:4010', 'http://localhost:3010'];
  it('accepts a report posted by the API origin or by our own return route', () => {
    expect(parseConnectMessage({ type: 'djaber:connect', report: report() }, 'http://localhost:4010', allowed)?.id).toBe('r1');
    expect(parseConnectMessage({ type: 'djaber:connect', report: report() }, 'http://localhost:3010', allowed)?.pages).toHaveLength(1);
  });
  it('ignores other origins, other message types and malformed payloads', () => {
    expect(parseConnectMessage({ type: 'djaber:connect', report: report() }, 'https://evil.example', allowed)).toBeNull();
    expect(parseConnectMessage({ type: 'other', report: report() }, allowed[0]!, allowed)).toBeNull();
    expect(parseConnectMessage('djaber:connect', allowed[0]!, allowed)).toBeNull();
    expect(parseConnectMessage(null, allowed[0]!, allowed)).toBeNull();
    expect(parseConnectMessage({ type: 'djaber:connect' }, allowed[0]!, allowed)).toBeNull();
    expect(parseConnectMessage({ type: 'djaber:connect', report: { outcome: 'error' } }, allowed[0]!, allowed)).toBeNull();
  });
  it('normalises a report: drops broken rows, fills the plan limit', () => {
    const r = normalizeReport({ outcome: 'ok', pages: [page({}), null, { name: 3 }], planLimit: null });
    expect(r?.pages).toHaveLength(1);
    expect(r?.planLimit).toEqual({ limit: -1, current: 1 });
    expect(r?.platform).toBe('facebook');
    expect(normalizeReport({ outcome: 'maybe' })).toBeNull();
  });
});

describe('connect outcomes (DLG "Reconnexion Meta — issues")', () => {
  it('maps each error code to its UI', () => {
    expect(connectOutcome(errorReport('OAUTH_CANCELLED'))).toEqual({ kind: 'cancelled' });
    expect(connectOutcome(errorReport('OAUTH_STATE_INVALID'))).toEqual({ kind: 'state-invalid' });
    expect(connectOutcome(errorReport('AUTH_EMAIL_UNVERIFIED'))).toEqual({ kind: 'unverified' });
    expect(connectOutcome(errorReport('META_UNAVAILABLE', 'Meta ne répond pas, réessayez.'))).toEqual({ kind: 'error', code: 'META_UNAVAILABLE', message: 'Meta ne répond pas, réessayez.' });
  });
  it('opens the per-page report on success, even when every page was skipped', () => {
    const r = report({ pages: [page({ status: 'skipped', code: 'PAGE_ALREADY_CONNECTED_ELSEWHERE', channelId: null })] });
    expect(connectOutcome(r)).toEqual({ kind: 'report', report: r });
  });
});

describe('connect report rows (DLG "Rapport de connexion")', () => {
  it('classifies CONNECTÉE / EN ATTENTE META / IGNORÉE / LIMITE / AVERTISSEMENT', () => {
    expect(reportRowKind(page({}))).toBe('connected');
    expect(reportRowKind(page({ status: 'pending_review', code: 'PAGE_INSTAGRAM_PENDING_APPROVAL' }))).toBe('pending');
    expect(reportRowKind(page({ status: 'skipped', code: 'PAGE_ALREADY_CONNECTED_ELSEWHERE' }))).toBe('ignored');
    expect(reportRowKind(page({ status: 'skipped', code: 'PAGE_MESSAGING_PERMISSION_MISSING' }))).toBe('ignored');
    expect(reportRowKind(page({ status: 'skipped', code: 'PAGE_ACCESS_TOKEN_MISSING' }))).toBe('ignored');
    expect(reportRowKind(page({ status: 'skipped', code: 'PLAN_LIMIT' }))).toBe('limit');
    expect(reportRowKind(page({ status: 'warning', code: 'PAGE_WEBHOOK_SUBSCRIBE_FAILED' }))).toBe('warning');
  });
  it('counts the pages found and the ones that ended up connected', () => {
    const r = report({
      pages: [page({}), page({ externalId: '2', status: 'warning', code: 'PAGE_WEBHOOK_SUBSCRIBE_FAILED' }), page({ externalId: '3', status: 'skipped', code: 'PLAN_LIMIT' }), page({ externalId: '4', status: 'pending_review' })],
    });
    expect(reportCounts(r)).toEqual({ found: 4, connected: 3 });
    expect(reportCounts(report({ pages: [page({ status: 'skipped', code: 'PLAN_LIMIT' })] })).connected).toBe(0);
  });
});

describe('overview helpers', () => {
  it('lists the permissions sorted by scope', () => {
    expect(permissionList({ permissions: { pages_messaging: 'granted', instagram_manage_messages: 'pending' } })).toEqual([
      { scope: 'instagram_manage_messages', state: 'pending' },
      { scope: 'pages_messaging', state: 'granted' },
    ]);
  });
  it('reads a Meta metric by key', () => {
    const metrics = [{ key: 'page_fans', value: 1234 }, { key: 'page_impressions', value: null }];
    expect(insightValue(metrics, 'page_fans')).toBe(1234);
    expect(insightValue(metrics, 'page_impressions')).toBeNull();
    expect(insightValue(undefined, 'page_fans')).toBeNull();
  });
  it('shortens the Meta id of the page', () => {
    expect(shortExternalId('104912345678982')).toBe('1049…82');
    expect(shortExternalId('1234')).toBe('1234');
  });
});

describe('history filters (URL `?kind=&period=`)', () => {
  // 2026-10-11 23:30 UTC = 2026-10-12 00:30 in Africa/Algiers (UTC+1)
  const now = Date.parse('2026-10-11T23:30:00.000Z');
  it('parses the period with 30 d as default', () => {
    expect(parseHistoryPeriod('7d')).toBe('7d');
    expect(parseHistoryPeriod('all')).toBe('all');
    expect(parseHistoryPeriod('1y')).toBe('30d');
    expect(parseHistoryPeriod(null)).toBe('30d');
  });
  it('keeps only known event kinds, once each', () => {
    expect(parseEventKinds('connected,bogus,history_synced,connected')).toEqual(['connected', 'history_synced']);
    expect(parseEventKinds('')).toEqual([]);
    expect(parseEventKinds(null)).toEqual([]);
  });
  it('builds an inclusive day range in Africa/Algiers', () => {
    expect(periodRange('7d', now)).toEqual({ from: '2026-10-06', to: '2026-10-12' });
    expect(periodRange('30d', now)).toEqual({ from: '2026-09-13', to: '2026-10-12' });
    expect(periodRange('all', now)).toEqual({});
  });
  it('builds the API query', () => {
    expect(eventsQuery(['connected', 'approved'], '7d', now)).toEqual({ kind: ['connected', 'approved'], from: '2026-10-06', to: '2026-10-12' });
    expect(eventsQuery([], 'all', now)).toEqual({});
  });
});
