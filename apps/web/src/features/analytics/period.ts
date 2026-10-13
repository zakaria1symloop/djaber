// Period of the analytics tabs and the report pages (04 §8, 12 §24, 11 §7): presets or a custom range ≤ 732 days,
// comparison with the previous period of the same length (`compare=previous`, default) or none. Everything lives in
// the URL (`?period=30d` | `?period=custom&from=…&to=…`, `&compare=none`). Pure functions, unit-tested.
import { algiersDay } from '@/features/orders/logic';

export const ANALYTICS_PRESETS = ['today', '7d', '30d', 'month', 'last_month', '90d', 'year'] as const;
export type AnalyticsPreset = (typeof ANALYTICS_PRESETS)[number];
export type PeriodKey = AnalyticsPreset | 'custom';
export const DEFAULT_PRESET: AnalyticsPreset = '30d';
export const MAX_RANGE_DAYS = 732;

export type PeriodState = { period: PeriodKey; from: string; to: string; compare: boolean };
type Params = { get(name: string): string | null };
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parsePeriod(params: Params): PeriodState {
  const raw = params.get('period') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const custom = raw === 'custom' || (!raw && (DAY.test(from) || DAY.test(to)));
  const period: PeriodKey = custom ? 'custom' : (ANALYTICS_PRESETS as readonly string[]).includes(raw) ? (raw as AnalyticsPreset) : DEFAULT_PRESET;
  return { period, from: custom && DAY.test(from) ? from : '', to: custom && DAY.test(to) ? to : '', compare: params.get('compare') !== 'none' };
}

/** Query pairs of the URL: defaults are omitted (30 d + comparison ⇒ clean URL). */
export function periodSearch(p: PeriodState): [string, string][] {
  const out: [string, string][] = [];
  if (p.period === 'custom') {
    out.push(['period', 'custom']);
    if (p.from) out.push(['from', p.from]);
    if (p.to) out.push(['to', p.to]);
  } else if (p.period !== DEFAULT_PRESET) out.push(['period', p.period]);
  if (!p.compare) out.push(['compare', 'none']);
  return out;
}

/** Parameters of `GET /analytics/*` and `GET /reports/:key`. */
export function periodQuery(p: PeriodState): Record<string, string> {
  const q: Record<string, string> = p.period === 'custom' ? { from: p.from, to: p.to } : { period: p.period };
  q.compare = p.compare ? 'previous' : 'none';
  return q;
}

/** Inclusive day count of `from` → `to` (both `YYYY-MM-DD`). */
export const rangeDays = (from: string, to: string): number => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

export type RangeError = 'REPORT_CUSTOM_RANGE_REQUIRED' | 'INVALID_DATE_RANGE' | 'REPORT_RANGE_TOO_LONG';
/** Client check of a custom range, same rule as the API (11 §7): both dates, end ≥ start, ≤ 732 days. */
export function customRangeError(from: string, to: string): RangeError | null {
  if (!DAY.test(from) || !DAY.test(to)) return 'REPORT_CUSTOM_RANGE_REQUIRED';
  if (to < from) return 'INVALID_DATE_RANGE';
  if (rangeDays(from, to) > MAX_RANGE_DAYS) return 'REPORT_RANGE_TOO_LONG';
  return null;
}

/** Today in Africa/Algiers (max of the date fields). */
export const todayAlgiers = (now = new Date()) => algiersDay(now);

/** A query string that keeps only the period keys (tab links, report links). */
export function periodHref(path: string, p: PeriodState, extra: [string, string][] = []): string {
  const qs = new URLSearchParams([...periodSearch(p), ...extra]).toString();
  return qs ? `${path}?${qs}` : path;
}
