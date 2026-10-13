// Pure rules of the status data (public page, help widget, maintenance banner). No React here (unit tested).
import { TIMEZONE } from '@djaber/shared';
import type { StatusPage } from './api';

export type ComponentState = 'operational' | 'degraded' | 'incident';
export type UptimeDay = 'ok' | 'degraded' | 'incident' | 'none';

/** `99.98` or `0.9998` → 99,98 % (fr) / 99.98 % (en, ar with Latin digits); at most 2 decimals, trailing zeros dropped. */
export const formatUptime = (value: number, locale: string): string => {
  const pct = value <= 1 ? value * 100 : value;
  const s = (Math.floor(pct * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  return `${locale === 'fr' ? s.replace('.', ',') : s}\u00a0%`;
};

/**
 * One bar per day for the 90-day strip: the API sends `days` (oldest first) when it has them; otherwise no bars are drawn
 * (the percentage alone is shown — bars are never invented from the average).
 */
export const uptimeDays = (c: StatusPage['components'][number]): UptimeDay[] | null => {
  const days = (c as { days?: unknown }).days;
  if (!Array.isArray(days) || days.length === 0) return null;
  return days.slice(-90).map((d) => (d === 'ok' || d === 'degraded' || d === 'incident' ? d : 'none'));
};

export const componentPillState = (s: ComponentState): 'ok' | 'warning' | 'incident' => (s === 'operational' ? 'ok' : s === 'degraded' ? 'warning' : 'incident');

/** Open incidents first (newest first), then resolved ones (newest first). */
export const sortIncidents = (list: StatusPage['incidents']): StatusPage['incidents'] =>
  [...list].sort((a, b) => {
    const ra = a.resolvedAt ? 1 : 0;
    const rb = b.resolvedAt ? 1 : 0;
    if (ra !== rb) return ra - rb;
    return Date.parse(b.startedAt) - Date.parse(a.startedAt);
  });

export const openIncidents = (s: StatusPage | undefined | null) => (s ? s.incidents.filter((i) => !i.resolvedAt && i.status !== 'resolved') : []);

/** Whole minutes since an instant (never negative). */
export const minutesSince = (iso: string, now = Date.now()) => Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));

const clockParts = (iso: string) => {
  const o: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, day: '2-digit', month: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso)))
    o[p.type] = p.value;
  return o;
};
/** `11:20` (Africa/Algiers) */
export const clock = (iso: string) => {
  const p = clockParts(iso);
  return `${p.hour}:${p.minute}`;
};
const MONTHS: Record<string, string[]> = {
  fr: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ar: ['جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان', 'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
};
/** `06 oct. 11:20` (Africa/Algiers, no year — the incident history of the status page) */
export const dayClock = (iso: string, locale: string) => {
  const p = clockParts(iso);
  const months = MONTHS[locale] ?? MONTHS.fr ?? [];
  return `${p.day} ${months[Number(p.month) - 1] ?? p.month} ${p.hour}:${p.minute}`;
};

/**
 * Maintenance banner of the shells (02 §1): shown while a window is scheduled or active. `scheduledTo` in the past ⇒ none.
 * Returns the window to display or null.
 */
export const maintenanceWindow = (s: StatusPage | undefined | null, now = Date.now()): { active: boolean; from: string | null; to: string | null; text: string | null } | null => {
  const m = s?.maintenance;
  if (!m) return null;
  const to = m.scheduledTo ? Date.parse(m.scheduledTo) : null;
  if (to !== null && to <= now) return null;
  if (!m.active && !m.scheduledFrom) return null;
  return { active: m.active, from: m.scheduledFrom, to: m.scheduledTo, text: m.text?.trim() ? m.text : null };
};
