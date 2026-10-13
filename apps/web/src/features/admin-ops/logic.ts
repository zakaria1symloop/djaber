// Pure rules of the support / settings / health admin screens (ADM-12/13/14). No business rule is computed here: the
// API gives statuses, SLA minutes and states; these helpers only map them to labels, tabs and query strings.
import type { AdminTicketDto, AppVersionDto, FeatureFlagDto, QueueHealthDto } from '@djaber/shared';
import type { OpsState } from '@djaber/ui';
import type { ApiQuery } from '@/lib/list-state';

/* ---------- durations: "20 min" · "2 h" · "3 h 25" ---------- */
export type DurationParts = { kind: 'min'; m: number } | { kind: 'h'; h: number } | { kind: 'hm'; h: number; m: number };
export function durationParts(minutes: number): DurationParts {
  const total = Math.max(0, Math.round(Math.abs(minutes)));
  if (total < 60) return { kind: 'min', m: total };
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? { kind: 'h', h } : { kind: 'hm', h, m: m };
}
export const durationKey = (p: DurationParts) => `adminOps.duration.${p.kind}`;
export const durationParams = (p: DurationParts) => (p.kind === 'min' ? { m: p.m } : p.kind === 'h' ? { h: p.h } : { h: p.h, m: String(p.m).padStart(2, '0') });

/* ---------- ADM-12 tabs and SLA pill ---------- */
export const TICKET_TABS = ['open', 'mine', 'pending', 'resolved', 'all'] as const;
export type TicketTab = (typeof TICKET_TABS)[number];
export const isTicketTab = (v: string | null | undefined): v is TicketTab => !!v && (TICKET_TABS as readonly string[]).includes(v);

/** Query of `GET /admin/support/tickets` for a tab (HELP-05: Ouverts / Assignés à moi / En attente du client / Résolus / Tous). */
export function ticketTabQuery(tab: TicketTab): ApiQuery {
  switch (tab) {
    case 'open':
      return { status: 'open' };
    case 'mine':
      return { assigneeId: 'me', status: 'open,pending_customer' };
    case 'pending':
      return { status: 'pending_customer' };
    case 'resolved':
      return { status: 'resolved,closed' };
    default:
      return {};
  }
}

export type SlaView = { kind: 'breached' | 'remaining' | 'waiting' | 'done'; minutes: number };
/** DÉPASSÉ DE n (red) · n RESTANTES (green) · EN ATTENTE CLIENT (muted); resolved / closed tickets show no SLA. */
export function ticketSla(t: Pick<AdminTicketDto, 'status' | 'slaBreached' | 'slaRemainingMin'>): SlaView {
  if (t.status === 'resolved' || t.status === 'closed') return { kind: 'done', minutes: 0 };
  if (t.status === 'pending_customer') return { kind: 'waiting', minutes: 0 };
  if (t.slaBreached || t.slaRemainingMin < 0) return { kind: 'breached', minutes: Math.abs(t.slaRemainingMin) };
  return { kind: 'remaining', minutes: t.slaRemainingMin };
}

/** Canned reply typed in the composer: "/sheets-reconnect" at the start of a word. Returns the partial key or null. */
export function cannedQuery(text: string, caret = text.length): string | null {
  const before = text.slice(0, caret);
  const m = /(?:^|\s)(\/[a-z0-9-]*)$/.exec(before);
  return m ? m[1]! : null;
}
/** Replaces the "/partial" before the caret by the canned body. */
export function insertCanned(text: string, caret: number, body: string): string {
  const before = text.slice(0, caret);
  const m = /(?:^|\s)(\/[a-z0-9-]*)$/.exec(before);
  if (!m) return `${before}${body}${text.slice(caret)}`;
  return `${before.slice(0, before.length - m[1]!.length)}${body}${text.slice(caret)}`;
}

/* ---------- ADM-14 queues ---------- */
export const queueState = (q: Pick<QueueHealthDto, 'state'>): OpsState => (q.state === 'ok' ? 'ok' : q.state === 'warning' ? 'warning' : q.state === 'incident' ? 'incident' : 'paused');

/** p95 cell: "0,4 s" · "48 s" · "14 min"; "—" when the queue completed nothing in the last hour. */
export type P95 = { kind: 'none' } | { kind: 's'; value: number } | { kind: 'min'; value: number };
export function p95(q: Pick<QueueHealthDto, 'p95Ms' | 'completedLastHour'>): P95 {
  if (!q.p95Ms && !q.completedLastHour) return { kind: 'none' };
  const s = q.p95Ms / 1000;
  if (s >= 600) return { kind: 'min', value: Math.round(s / 60) };
  return { kind: 's', value: s >= 10 ? Math.round(s) : Math.round(s * 10) / 10 };
}

/** KPI "jobs en retard": the non-OK queue with the largest backlog (waiting + delayed), else the largest overall. */
export function backlogQueue(queues: QueueHealthDto[]): QueueHealthDto | null {
  if (!queues.length) return null;
  const score = (q: QueueHealthDto) => q.waiting + q.delayed;
  const bad = queues.filter((q) => q.state !== 'ok');
  const pool = bad.length ? bad : queues;
  return [...pool].sort((a, b) => score(b) - score(a))[0] ?? null;
}

/* ---------- ADM-13 app versions & flags ---------- */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}
/** Raising `minVersion` is a "force update": the dialog asks for the 2FA code and shows the impact (PFS-01, AT-PFS-02). */
export const isForceUpdate = (current: Pick<AppVersionDto, 'minVersion'>, nextMin: string) => /^\d+(\.\d+){1,3}$/.test(nextMin) && compareVersions(nextMin, current.minVersion) > 0;
/** `minVersion` cannot exceed the published version while the store has not published it (AT-PFS-02 warning). */
export const minAboveUnpublished = (v: Pick<AppVersionDto, 'storeStatus' | 'latestVersion'>, nextMin: string) => v.storeStatus !== 'published' && v.storeStatus !== 'rollout' && compareVersions(nextMin, v.latestVersion) > 0;

/** "CIBLE" cell of a flag: "100 %" · "20 % · Pro" · "liste : 3 espaces" · "50 % A/B". */
export type FlagTarget = { pct: number; plans: string[]; workspaces: number; abTest: boolean };
export function flagTarget(f: Pick<FeatureFlagDto, 'webPct' | 'mobilePct' | 'targeting'>): FlagTarget {
  return { pct: Math.max(f.webPct, f.mobilePct), plans: f.targeting.planSlugs ?? [], workspaces: f.targeting.workspaceIds?.length ?? 0, abTest: !!f.targeting.abTest };
}
/** Switch of the WEB / MOBILE column: on = the flag is active and its percentage is above 0. */
export const flagOn = (f: Pick<FeatureFlagDto, 'isActive'>, pct: number) => f.isActive && pct > 0;
