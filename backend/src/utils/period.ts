// ============================================================================
// Shared analytics / reports window resolution.
//
// Two modes:
//   1. Custom range — when both `startDate` and `endDate` query params are
//      supplied AND valid, the window is [startOfDay(startDate),
//      endOfDay(endDate)]. Buckets are monthly when the span exceeds 92 days,
//      daily otherwise.
//   2. Period fallback — otherwise the classic today / week / month / year
//      windows. This path is replicated EXACTLY from the original inline
//      controller logic (rolling 7 / 30 / 365-day windows, start-of-today for
//      'today') so that omitting the date params yields identical output.
//
// The fallback `dateFilter` stays open-ended (`{ gte: start }`, no upper bound)
// on purpose: order / sale dates can be backdated up to a day in the future, so
// adding an `lte` bound would change results for the classic periods. Custom
// ranges add the `lte` bound because that is the whole point of a range.
// ============================================================================

import { ApiError } from '../errors';
import { Validator } from '../middleware/validate';

export type AnalyticsPeriod = 'today' | 'week' | 'month' | 'year';

/** Presets accepted on the wire. 'custom' means "use startDate / endDate". */
export const ANALYTICS_PERIODS = ['today', 'week', 'month', 'year', 'custom'] as const;
export type AnalyticsPeriodParam = (typeof ANALYTICS_PERIODS)[number];

/** Longest custom range we agree to compute (in days, ~2 years). */
export const MAX_CUSTOM_RANGE_DAYS = 2 * 366;

// Prisma DateTime filter for a window's primary date column.
export type WindowDateFilter = { gte: Date; lte?: Date };

export interface ResolvedWindow {
  /** Echoed back in every response (unchanged contract). */
  period: AnalyticsPeriod;
  /** Inclusive lower bound of the window. */
  start: Date;
  /** Upper bound of the window (end-of-day for ranges, "now" for periods). */
  end: Date;
  /** Window length in days (velocity / burn / stock-cover math). */
  days: number;
  /** Time-series bucket granularity. */
  bucket: 'day' | 'month';
  /** True only when a valid custom [startDate, endDate] range was supplied. */
  custom: boolean;
  /** Ready-made Prisma filter for the window's primary date column. */
  dateFilter: WindowDateFilter;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const endOfDay = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

const normalizePeriod = (raw: unknown): AnalyticsPeriod =>
  raw === 'today' || raw === 'week' || raw === 'year' ? raw : 'month';

// Parse a query param into a LOCAL-time Date. `YYYY-MM-DD` is treated as local
// midnight (matching the local-day convention used everywhere else); anything
// else falls back to Date parsing. Returns null when missing / blank / invalid.
const parseDateParam = (raw: unknown): Date | null => {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]) - 1;
    const day = Number(ymd[3]);
    const dt = new Date(year, month, day);
    // Reject impossible dates that JS would roll over (e.g. 2026-13-40).
    if (dt.getFullYear() !== year || dt.getMonth() !== month || dt.getDate() !== day) {
      return null;
    }
    return dt;
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

// Build a period-fallback result. `dateFilter` intentionally omits `lte` so the
// query stays byte-identical to the original controllers.
const periodResult = (
  period: AnalyticsPeriod,
  start: Date,
  end: Date,
  days: number,
  bucket: 'day' | 'month'
): ResolvedWindow => ({
  period,
  start,
  end,
  days,
  bucket,
  custom: false,
  dateFilter: { gte: start },
});

export const resolveWindow = (
  period: unknown,
  startDateStr?: unknown,
  endDateStr?: unknown
): ResolvedWindow => {
  const startDate = parseDateParam(startDateStr);
  const endDate = parseDateParam(endDateStr);

  // ---- Custom range (both bounds valid) ---------------------------------
  if (startDate && endDate) {
    // Tolerate a reversed range rather than producing a negative span.
    const [lo, hi] =
      startDate.getTime() <= endDate.getTime()
        ? [startDate, endDate]
        : [endDate, startDate];
    const start = startOfDay(lo);
    const end = endOfDay(hi);
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS));
    const bucket: 'day' | 'month' = days > 92 ? 'month' : 'day';
    return {
      period: normalizePeriod(period),
      start,
      end,
      days,
      bucket,
      custom: true,
      dateFilter: { gte: start, lte: end },
    };
  }

  // ---- Period fallback — replicated EXACTLY from the controllers --------
  const p = normalizePeriod(period);
  const now = new Date();
  switch (p) {
    case 'today':
      return periodResult(p, new Date(now.getFullYear(), now.getMonth(), now.getDate()), now, 1, 'day');
    case 'week':
      return periodResult(p, new Date(now.getTime() - 7 * DAY_MS), now, 7, 'day');
    case 'year':
      return periodResult(p, new Date(now.getTime() - 365 * DAY_MS), now, 365, 'month');
    default:
      return periodResult('month', new Date(now.getTime() - 30 * DAY_MS), now, 30, 'day');
  }
};

// ============================================================================
// Strict variant used by the controllers: same windows as `resolveWindow`,
// but bad input is REJECTED (400) instead of silently falling back.
//
//   period      optional, one of ANALYTICS_PERIODS (default 'month')
//               → FIELD_INVALID_ENUM
//   startDate / endDate
//               optional; if one is given the other is required
//               (FIELD_REQUIRED), each must parse (FIELD_INVALID_DATE),
//               start ≤ end (INVALID_DATE_RANGE), span ≤ 2 years
//               (ANALYTICS_RANGE_TOO_LONG). `period=custom` without both
//               dates → ANALYTICS_CUSTOM_RANGE_REQUIRED.
//
// The computed window is byte-identical to `resolveWindow` for valid input.
// ============================================================================

type QueryLike = Record<string, unknown>;

const isBlank = (raw: unknown): boolean =>
  raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '');

export const parseWindow = (query: QueryLike): ResolvedWindow => {
  const v = new Validator();
  const period = v.oneOf(query.period, 'period', ANALYTICS_PERIODS, 'month');

  const hasStart = !isBlank(query.startDate);
  const hasEnd = !isBlank(query.endDate);
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  if (hasStart || hasEnd) {
    if (!hasStart) v.add('startDate', 'FIELD_REQUIRED');
    else if (typeof query.startDate !== 'string' || !(startDate = parseDateParam(query.startDate))) {
      v.add('startDate', 'FIELD_INVALID_DATE');
    }
    if (!hasEnd) v.add('endDate', 'FIELD_REQUIRED');
    else if (typeof query.endDate !== 'string' || !(endDate = parseDateParam(query.endDate))) {
      v.add('endDate', 'FIELD_INVALID_DATE');
    }
  }
  v.throwIfAny();

  if (period === 'custom' && !(startDate && endDate)) {
    throw new ApiError('ANALYTICS_CUSTOM_RANGE_REQUIRED');
  }

  if (startDate && endDate) {
    if (startDate.getTime() > endDate.getTime()) throw new ApiError('INVALID_DATE_RANGE');
    const span = Math.round((endOfDay(endDate).getTime() - startOfDay(startDate).getTime()) / DAY_MS);
    if (span > MAX_CUSTOM_RANGE_DAYS) throw new ApiError('ANALYTICS_RANGE_TOO_LONG', { maxYears: 2 });
    return resolveWindow(period, query.startDate, query.endDate);
  }

  return resolveWindow(period);
};
