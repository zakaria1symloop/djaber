// Pure decisions of the channels screens: card state, platform tabs, connect outcomes, connect-report rows, swap
// candidates, history filters. No React, no fetch: covered by logic.spec.ts.
import type { Tone } from '@djaber/ui';
import { CHANNEL_EVENT_KINDS, CONNECT_MESSAGE_TYPE, type Channel, type ChannelEventKind, type ChannelHealth, type ConnectReport, type ConnectReportPage, type PlanLimit } from './contracts';

/* ---------- card state (CHN-06, GLOBAL "Plan expired") ---------- */
export type CardState = 'active' | 'pending_review' | 'needs_reconnect' | 'paused_plan' | 'paused_moderation' | 'paused' | 'disabled' | 'disconnected';
/** `paused` splits by reason: plan (free limits, "Reprendre" swaps), moderation, manual. */
export const cardState = (c: Pick<Channel, 'status' | 'pausedReason'>): CardState => {
  if (c.status === 'paused') return c.pausedReason === 'plan' ? 'paused_plan' : c.pausedReason === 'moderation' ? 'paused_moderation' : 'paused';
  return c.status;
};
/** the AI can answer on this page right now */
export const isLive = (c: Pick<Channel, 'status'>) => c.status === 'active';
/** greyed card: nothing is answered (paused, disabled, disconnected) */
export const isDimmed = (c: Pick<Channel, 'status' | 'pausedReason'>) => ['paused_plan', 'paused_moderation', 'paused', 'disabled', 'disconnected'].includes(cardState(c));

/* ---------- platform tabs (URL `?tab=`) ---------- */
export const PLATFORM_TABS = ['all', 'facebook', 'instagram'] as const;
export type PlatformTab = (typeof PLATFORM_TABS)[number];
export const parsePlatformTab = (raw: string | null | undefined): PlatformTab => ((PLATFORM_TABS as readonly string[]).includes(raw ?? '') ? (raw as PlatformTab) : 'all');
export const platformCounts = (rows: readonly Pick<Channel, 'platform'>[]): Record<PlatformTab, number> => ({
  all: rows.length,
  facebook: rows.filter((c) => c.platform === 'facebook').length,
  instagram: rows.filter((c) => c.platform === 'instagram').length,
});
export const filterByTab = <T extends Pick<Channel, 'platform'>>(rows: readonly T[], tab: PlatformTab): T[] => (tab === 'all' ? [...rows] : rows.filter((c) => c.platform === tab));

/** "3 pages · 2 actives · 1 à reconnecter · limite du plan 3 / 3" */
export const listSummary = (rows: readonly Pick<Channel, 'status'>[]) => ({
  total: rows.length,
  active: rows.filter((c) => c.status === 'active').length,
  reconnect: rows.filter((c) => c.status === 'needs_reconnect').length,
});
/** `-1` = unlimited (api-contract §3.2) */
export const limitReached = (l: PlanLimit | null | undefined) => !!l && l.limit >= 0 && l.current >= l.limit;

/** Pages shown by the shell banners: the first one to reconnect, the first one waiting for Meta. */
export const bannerChannels = <T extends Pick<Channel, 'status'>>(rows: readonly T[]) => ({
  reconnect: rows.find((c) => c.status === 'needs_reconnect') ?? null,
  pending: rows.find((c) => c.status === 'pending_review') ?? null,
});

/** "Réactiver et échanger": the active pages that can be paused instead, the least busy first. */
export const swapCandidates = <T extends Pick<Channel, 'id' | 'status' | 'counts'>>(rows: readonly T[], targetId: string): T[] =>
  rows.filter((c) => c.id !== targetId && c.status === 'active').sort((a, b) => a.counts.conversations - b.counts.conversations);

/* ---------- connect flow ---------- */
/**
 * Reads a `message` event of the popup. Only the API origin and our own origin (same-tab return route relaying to
 * its opener) are trusted; anything else — other origins, other message types, malformed reports — is ignored.
 */
export function parseConnectMessage(data: unknown, origin: string, allowedOrigins: readonly string[]): ConnectReport | null {
  if (!allowedOrigins.includes(origin)) return null;
  if (!data || typeof data !== 'object') return null;
  const m = data as { type?: unknown; report?: unknown };
  if (m.type !== CONNECT_MESSAGE_TYPE) return null;
  return normalizeReport(m.report);
}
export function normalizeReport(raw: unknown): ConnectReport | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<ConnectReport>;
  if (r.outcome !== 'ok' && r.outcome !== 'error') return null;
  const pages = Array.isArray(r.pages) ? r.pages.filter((p): p is ConnectReportPage => !!p && typeof p === 'object' && typeof p.name === 'string' && typeof p.status === 'string') : [];
  const limit = r.planLimit && typeof r.planLimit.limit === 'number' && typeof r.planLimit.current === 'number' ? r.planLimit : { limit: -1, current: pages.length };
  const error = r.error && typeof r.error.code === 'string' ? { code: r.error.code, message: typeof r.error.message === 'string' ? r.error.message : '' } : null;
  if (r.outcome === 'error' && !error) return null;
  return { id: typeof r.id === 'string' ? r.id : '', platform: r.platform === 'instagram' ? 'instagram' : 'facebook', outcome: r.outcome, error, pages, planLimit: limit };
}
/** A flow that ended without a report (same-tab return with `?connectError=CODE`). */
export const errorReport = (code: string, message = ''): ConnectReport => ({ id: '', platform: 'facebook', outcome: 'error', error: { code, message }, pages: [], planLimit: { limit: -1, current: 0 } });

export type ConnectOutcome =
  | { kind: 'cancelled' }
  | { kind: 'state-invalid' }
  | { kind: 'unverified' }
  | { kind: 'error'; code: string; message: string }
  | { kind: 'report'; report: ConnectReport };
/** DLG "Reconnexion Meta — issues": REFUSÉ ⇒ toast, ÉTAT INVALIDE ⇒ dialog, E-MAIL NON VÉRIFIÉ ⇒ dialog, SUCCÈS ⇒ report. */
export function connectOutcome(report: ConnectReport): ConnectOutcome {
  if (report.outcome === 'ok') return { kind: 'report', report };
  const code = report.error?.code ?? 'INTERNAL';
  if (code === 'OAUTH_CANCELLED') return { kind: 'cancelled' };
  if (code === 'OAUTH_STATE_INVALID') return { kind: 'state-invalid' };
  if (code === 'AUTH_EMAIL_UNVERIFIED') return { kind: 'unverified' };
  return { kind: 'error', code, message: report.error?.message ?? '' };
}

/** Row of "Rapport de connexion": CONNECTÉE · EN ATTENTE META · IGNORÉE (code) · LIMITE (PLAN_LIMIT) · AVERTISSEMENT. */
export type ReportRowKind = 'connected' | 'pending' | 'ignored' | 'limit' | 'warning';
export const reportRowKind = (p: Pick<ConnectReportPage, 'status' | 'code'>): ReportRowKind => {
  if (p.code === 'PLAN_LIMIT') return 'limit';
  if (p.status === 'pending_review' || p.code === 'PAGE_INSTAGRAM_PENDING_APPROVAL') return 'pending';
  if (p.status === 'warning') return 'warning';
  if (p.status === 'connected') return 'connected';
  return 'ignored';
};
export const REPORT_ROW_TONE: Record<ReportRowKind, Tone> = { connected: 'success', pending: 'warning', ignored: 'danger', limit: 'warning', warning: 'warning' };
export const reportCounts = (r: Pick<ConnectReport, 'pages'>) => ({
  found: r.pages.length,
  connected: r.pages.filter((p) => ['connected', 'pending', 'warning'].includes(reportRowKind(p))).length,
});

/* ---------- health block (CHN-07 "SANTÉ DE LA CONNEXION") ---------- */
export const permissionList = (h: Pick<ChannelHealth, 'permissions'>) =>
  Object.entries(h.permissions ?? {})
    .map(([scope, state]) => ({ scope, state }))
    .sort((a, b) => a.scope.localeCompare(b.scope));

/** Meta insight tile value by key; null when Meta gave nothing for it ("—"). */
export const insightValue = (metrics: readonly { key: string; value: number | null }[] | undefined, key: string): number | null => metrics?.find((m) => m.key === key)?.value ?? null;

/* ---------- history tab (URL `?kind=&period=`) ---------- */
export const HISTORY_PERIODS = ['7d', '30d', '90d', 'all'] as const;
export type HistoryPeriod = (typeof HISTORY_PERIODS)[number];
export const parseHistoryPeriod = (raw: string | null | undefined): HistoryPeriod => ((HISTORY_PERIODS as readonly string[]).includes(raw ?? '') ? (raw as HistoryPeriod) : '30d');
export const parseEventKinds = (raw: string | null | undefined): ChannelEventKind[] =>
  [...new Set((raw ?? '').split(',').map((s) => s.trim()))].filter((k): k is ChannelEventKind => (CHANNEL_EVENT_KINDS as readonly string[]).includes(k));

const algiersDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
/** `from` / `to` (YYYY-MM-DD, Africa/Algiers, `to` inclusive) of a period ending today; `all` sends no bound. */
export const periodRange = (period: HistoryPeriod, now = Date.now()): { from?: string; to?: string } => {
  if (period === 'all') return {};
  const days = Number(period.replace('d', ''));
  return { from: algiersDay(new Date(now - (days - 1) * 86_400_000)), to: algiersDay(new Date(now)) };
};
/** Query of `GET /channels/:id/events` for the URL state. */
export const eventsQuery = (kinds: readonly ChannelEventKind[], period: HistoryPeriod, now = Date.now()): Record<string, string | string[]> => {
  const q: Record<string, string | string[]> = {};
  if (kinds.length) q.kind = [...kinds];
  const r = periodRange(period, now);
  if (r.from) q.from = r.from;
  if (r.to) q.to = r.to;
  return q;
};

/** "ID 1049…82": the Meta id of the page, shortened for the header line. */
export const shortExternalId = (id: string) => (id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-2)}` : id);
