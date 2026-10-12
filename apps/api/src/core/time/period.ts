// 04 §8 / api-contract §1.6 — list and KPI periods in Africa/Algiers: presets today / 7d / 30d / month / last_month /
// 90d / year, or a custom `from`–`to` (date-only `to` inclusive, ≤ 732 days ⇒ else 422 REPORT_RANGE_TOO_LONG).
import { AppException } from '../errors/app.exception';
import { algiersDay, algiersDayEnd, algiersDayStart } from './algiers';

export type PeriodKey = 'today' | '7d' | '30d' | 'month' | 'last_month' | '90d' | 'year' | 'custom';
export const MAX_RANGE_DAYS = 732;
const DAY = 86_400_000;

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/** `[gte, lt)` instants of a period; `null` bounds are open. `now` only matters for the presets. */
export const periodRange = (p: { period?: PeriodKey; from?: string; to?: string }, now: Date = new Date()): { gte: Date | null; lt: Date | null } => {
  const today = algiersDay(now);
  const [y, m] = today.split('-').map(Number) as [number, number];
  const ym = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, '0')}-01`;
  switch (p.period) {
    case 'today':
      return { gte: algiersDayStart(today), lt: algiersDayEnd(today) };
    case '7d':
      return { gte: algiersDayStart(addDays(today, -6)), lt: algiersDayEnd(today) };
    case '30d':
      return { gte: algiersDayStart(addDays(today, -29)), lt: algiersDayEnd(today) };
    case '90d':
      return { gte: algiersDayStart(addDays(today, -89)), lt: algiersDayEnd(today) };
    case 'month':
      return { gte: algiersDayStart(ym(y, m)), lt: algiersDayEnd(today) };
    case 'last_month': {
      const [py, pm] = m === 1 ? [y - 1, 12] : [y, m - 1];
      return { gte: algiersDayStart(ym(py, pm)), lt: algiersDayStart(ym(y, m)) };
    }
    case 'year':
      return { gte: algiersDayStart(`${y}-01-01`), lt: algiersDayEnd(today) };
    default: {
      const gte = p.from ? algiersDayStart(p.from) : null;
      const lt = p.to ? algiersDayEnd(p.to) : null;
      if (gte && lt) {
        if (lt.getTime() <= gte.getTime()) throw new AppException('INVALID_DATE_RANGE', {}, { to: 'validation.date' });
        if ((lt.getTime() - gte.getTime()) / DAY > MAX_RANGE_DAYS) throw new AppException('REPORT_RANGE_TOO_LONG');
      }
      return { gte, lt };
    }
  }
};

/** The `n` days ending today (Africa/Algiers) and the `n` days before them — KPI tiles "30 j" with their comparison. */
export const lastDays = (n: number, now: Date = new Date()) => {
  const today = algiersDay(now);
  const start = algiersDayStart(addDays(today, -(n - 1)));
  const end = algiersDayEnd(today);
  return { current: { gte: start, lt: end }, previous: { gte: new Date(start.getTime() - n * DAY), lt: start } };
};
