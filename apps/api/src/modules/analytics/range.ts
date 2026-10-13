// 04 §8 / 11 §7 / 12 §24 — period of the analytics tabs and of the reports, as Africa/Algiers days.
// Presets today / 7d / 30d / month / last_month / 90d / year, or custom `from`–`to` (both required, `to` inclusive,
// at most 732 days). Previous period (compare=previous) = same number of days ending the day before `from`.
import { ANALYTICS_DEFAULT_PERIOD, ANALYTICS_MAX_RANGE_DAYS, type AnalyticsPeriod } from '@djaber/shared';
import { AppException } from '../../core/errors/app.exception';
import { algiersDay, algiersDayEnd, algiersDayStart } from '../../core/time/algiers';

const DAY = 86_400_000;
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY) + 1;
export const eachDay = (from: string, to: string): string[] => {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};

export type DayRange = {
  period: AnalyticsPeriod;
  from: string;
  to: string;
  days: number;
  gte: Date;
  lt: Date;
  compare: 'previous' | 'none';
  previous: { from: string; to: string; gte: Date; lt: Date } | null;
};

export const toDayRange = (from: string, to: string) => ({ from, to, gte: algiersDayStart(from), lt: algiersDayEnd(to) });

export function resolveRange(q: { period?: AnalyticsPeriod; from?: string; to?: string; compare?: 'previous' | 'none' }, now: Date = new Date()): DayRange {
  const today = algiersDay(now);
  const [y, m] = today.split('-').map(Number) as [number, number];
  const ym = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, '0')}-01`;
  const custom = q.period === 'custom' || (!q.period && (q.from !== undefined || q.to !== undefined));
  const period: AnalyticsPeriod = custom ? 'custom' : (q.period ?? ANALYTICS_DEFAULT_PERIOD);
  let from: string;
  let to: string;
  switch (period) {
    case 'custom':
      if (!q.from || !q.to) throw new AppException('REPORT_CUSTOM_RANGE_REQUIRED', {}, { ...(q.from ? {} : { from: 'validation.required' }), ...(q.to ? {} : { to: 'validation.required' }) });
      from = q.from;
      to = q.to;
      if (to < from) throw new AppException('INVALID_DATE_RANGE', {}, { to: 'validation.date' });
      if (daysBetween(from, to) > ANALYTICS_MAX_RANGE_DAYS) throw new AppException('REPORT_RANGE_TOO_LONG');
      break;
    case 'today':
      from = to = today;
      break;
    case '7d':
      from = addDays(today, -6);
      to = today;
      break;
    case '90d':
      from = addDays(today, -89);
      to = today;
      break;
    case 'month':
      from = ym(y, m);
      to = today;
      break;
    case 'last_month': {
      const [py, pm] = m === 1 ? [y - 1, 12] : [y, m - 1];
      from = ym(py, pm);
      to = addDays(ym(y, m), -1);
      break;
    }
    case 'year':
      from = `${y}-01-01`;
      to = today;
      break;
    case '30d':
    default:
      from = addDays(today, -29);
      to = today;
  }
  const days = daysBetween(from, to);
  const compare = q.compare ?? 'previous';
  const pTo = addDays(from, -1);
  const pFrom = addDays(pTo, -(days - 1));
  return {
    period,
    from,
    to,
    days,
    gte: algiersDayStart(from),
    lt: algiersDayEnd(to),
    compare,
    previous: compare === 'previous' ? { from: pFrom, to: pTo, gte: algiersDayStart(pFrom), lt: algiersDayEnd(pTo) } : null,
  };
}

/** Relative change in % with one decimal (same rounding as the home KPI tiles). */
export const deltaPct = (value: number | null, previous: number | null | undefined): number | null =>
  value === null || previous === null || previous === undefined || previous === 0 ? null : Math.round(((value - previous) * 1000) / previous) / 10;
export const pct = (part: number, whole: number): number | null => (whole > 0 ? Math.round((part * 1000) / whole) / 10 : null);
export const round1 = (v: number | null | undefined) => (v === null || v === undefined || Number.isNaN(v) ? null : Math.round(v * 10) / 10);
