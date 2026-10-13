// ADM-11 pure mapping of the URL (tabs, filters) and of the treatment panel (no business rule: the API decides).
import type { ReportAdminDto, ReportStatsDto } from '@djaber/shared';
import type { ApiQuery, ListSpec } from '@/lib/list-state';

export const REPORT_TABS = ['todo', 'customers', 'merchants', 'ai', 'done'] as const;
export type ReportTab = (typeof REPORT_TABS)[number];

export const REPORTS_SPEC: ListSpec = {
  filters: { type: 'list', severity: 'list', reporterKind: 'list', period: 'text' },
  sorts: ['createdAt'],
  defaultSort: '-createdAt',
  tabs: REPORT_TABS.filter((t) => t !== 'todo'),
};
export const reportTabOf = (tab: string | null): ReportTab => (tab && (REPORT_TABS as readonly string[]).includes(tab) ? (tab as ReportTab) : 'todo');

const OPEN = ['open', 'reviewing'];
/** Preset of each tab, merged over the URL filters (a tab's `type` wins over the Type filter). */
export function reportTabQuery(tab: ReportTab): ApiQuery {
  switch (tab) {
    case 'customers':
      return { type: ['customer', 'conversation'] };
    case 'merchants':
      return { type: ['merchant'] };
    case 'ai':
      return { type: ['ai_message'] };
    case 'done':
      return { status: ['actioned', 'dismissed'] };
    default:
      return { status: OPEN };
  }
}
export function reportTabCount(tab: ReportTab, s: ReportStatsDto | undefined): number | null {
  if (!s) return null;
  return { todo: s.tabs.todo, customers: s.tabs.customers, merchants: s.tabs.merchants, ai: s.tabs.aiContent, done: s.tabs.done }[tab];
}

/** "Période ⌄" presets → from / to (Africa/Algiers days, inclusive). */
export const PERIODS = ['24h', '7d', '30d', '90d'] as const;
export function periodRange(period: string, now = new Date()): { from: string; to: string } | null {
  const days = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 }[period as (typeof PERIODS)[number]];
  if (!days) return null;
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return { from: day(new Date(now.getTime() - (days - 1) * 86_400_000)), to: day(now) };
}

/** Decisions offered by the treatment panel, in the frame order; "more_info" is the secondary button. */
export const PANEL_DECISIONS = ['block_confirmed', 'platform_blacklist', 'reported_to_meta', 'dismissed'] as const;
export type PanelDecision = (typeof PANEL_DECISIONS)[number] | 'more_info';

/** A decision is offered when the server descriptor says so (or, without descriptors, when the target fits). */
export function decisionOffered(r: Pick<ReportAdminDto, 'type' | 'actions'>, d: PanelDecision): { offered: boolean; enabled: boolean; reasonCode?: string } {
  const desc = r.actions?.find((a) => a.key === d || a.key === `decide.${d}`);
  if (desc) return { offered: true, enabled: desc.enabled, reasonCode: desc.enabled ? undefined : desc.reasonCode };
  if (d === 'block_confirmed' || d === 'platform_blacklist') return { offered: r.type === 'customer' || r.type === 'conversation', enabled: true };
  if (d === 'reported_to_meta') return { offered: r.type === 'customer' || r.type === 'conversation' || r.type === 'merchant', enabled: true };
  return { offered: true, enabled: true };
}

/** API query of the list: the URL state minus `sort` / `period` (not API names), the period as from / to, the tab preset. */
export function reportsApiQuery(base: ApiQuery, tab: ReportTab, now = new Date()): ApiQuery {
  const { sort: _sort, period, ...rest } = base;
  const range = typeof period === 'string' ? periodRange(period, now) : null;
  return { ...rest, ...(range ?? {}), ...reportTabQuery(tab) };
}

export const isOpenReport = (r: Pick<ReportAdminDto, 'status'>) => OPEN.includes(r.status);

/** "HH:mm" of an excerpt line in Africa/Algiers. */
export const excerptTime = (iso: string) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Algiers', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

/** Current month in Africa/Algiers as `YYYY-MM` and the previous one (default of the compliance export). */
export function previousMonth(now = new Date()): string {
  const [y, m] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit' }).format(now).split('-').map(Number) as [number, number];
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return `${py}-${String(pm).padStart(2, '0')}`;
}
