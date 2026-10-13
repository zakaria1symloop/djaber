'use client';
// Small display pieces of the admin core screens: square mono status pills (Figma admin frames), short dates, numbers,
// money and relative times, the "who · when" line.
import { formatDate, formatDateTime, formatMoney, formatNumber, type AppLocale } from '@djaber/shared';
import { Ltr, MonoChip } from '@djaber/ui';
import type { ReactNode } from 'react';
import { useLocaleCode, useT } from '@/lib/i18n';
import { relativeTime } from '@/lib/time';

type ChipTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

/** Tone of each admin status value (REF — Component sheet: money = done, inbound = in progress, starred = attention, alert = blocking). */
export const ADMIN_TONES: Record<string, Record<string, ChipTone>> = {
  'Workspace.status': { active: 'success', suspended: 'danger', deletion_scheduled: 'danger' },
  'Subscription.status': { trial: 'info', active: 'success', dunning: 'warning', expired: 'danger', cancelled: 'neutral' },
  'Subscription.dunningStage': { d_minus_7: 'warning', d0: 'warning', d_plus_3: 'warning', expired: 'danger' },
  'Workspace.trustLevel': { new: 'neutral', standard: 'info', trusted: 'success', watch: 'danger' },
  'Invoice.status': { upcoming: 'neutral', unpaid: 'danger', paid: 'success', void: 'neutral', refunded: 'neutral' },
  'User.status': { active: 'success', blocked: 'danger', deletion_scheduled: 'danger', unverified: 'warning' },
  'Promo.state': { active: 'success', used: 'neutral', expired: 'neutral', inactive: 'neutral' },
  'Cms.status': { published: 'success', missing: 'danger', draft: 'warning', scheduled: 'info', archived: 'neutral' },
  'Preset.status': { published: 'info', draft: 'neutral', archived: 'danger' },
  'Deletion.status': { pending_confirmation: 'neutral', grace: 'warning', blocked: 'danger', anonymised: 'neutral', cancelled: 'neutral' },
  'Audit.action': { danger: 'danger', money: 'success', warn: 'warning', info: 'info' },
};

export function AdminPill({ group, value, children, className }: { group: keyof typeof ADMIN_TONES | string; value: string; children: ReactNode; className?: string }) {
  return (
    <span data-pill={`${group}:${value}`} className="inline-flex max-w-full">
      <MonoChip tone={ADMIN_TONES[group]?.[value] ?? 'neutral'} className={className}>
        {children}
      </MonoChip>
    </span>
  );
}

/** "12 mars" — day + month (Africa/Algiers); `—` when null. */
export function ShortDate({ iso, muted }: { iso: string | null | undefined; muted?: boolean }) {
  const locale = useLocaleCode() as AppLocale;
  if (!iso) return <span className="text-text-muted">—</span>;
  const full = formatDate(iso, locale);
  return (
    <span className={muted ? 'whitespace-nowrap text-text-muted' : 'whitespace-nowrap'} title={full}>
      {full.split(' ').slice(0, 2).join(' ')}
    </span>
  );
}

export const useFormats = () => {
  const locale = useLocaleCode() as AppLocale;
  return {
    locale,
    date: (iso: string | null | undefined) => (iso ? formatDate(iso, locale) : '—'),
    short: (iso: string | null | undefined) => (iso ? formatDate(iso, locale).split(' ').slice(0, 2).join(' ') : '—'),
    dateTime: (iso: string | null | undefined) => (iso ? formatDateTime(iso, locale) : '—'),
    /** "05 oct. 11:42" */
    shortTime: (iso: string | null | undefined) => {
      if (!iso) return '—';
      const full = formatDateTime(iso, locale).split(' ');
      return `${full[0]} ${full[1]} ${full[3] ?? ''}`.trim();
    },
    ago: (iso: string | null | undefined) => relativeTime(iso, locale),
    num: (n: number | null | undefined) => (n === null || n === undefined ? '—' : formatNumber(n)),
    money: (n: number | null | undefined) => (n === null || n === undefined ? '—' : formatMoney(n)),
  };
};

export function Num({ value, className }: { value: number | null | undefined; className?: string }) {
  return <Ltr className={className ?? 'tabular-nums'}>{value === null || value === undefined ? '—' : formatNumber(value)}</Ltr>;
}

export function Money({ value, className }: { value: number | null | undefined; className?: string }) {
  return <Ltr className={className ?? 'whitespace-nowrap tabular-nums'}>{value === null || value === undefined ? '—' : formatMoney(value)}</Ltr>;
}

/** Limit value with −1 = illimité. */
export function useLimit() {
  const t = useT();
  return (n: number | null | undefined) => (n === null || n === undefined ? '—' : n < 0 ? t('admin.common.unlimited') : formatNumber(n));
}

export const fullName = (u: { firstName?: string | null; lastName?: string | null } | null | undefined) => (u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : '');
/** "Zakaria A." */
export const shortName = (u: { firstName?: string | null; lastName?: string | null } | null | undefined) => {
  if (!u) return '';
  const last = (u.lastName ?? '').trim();
  return `${(u.firstName ?? '').trim()}${last ? ` ${last[0]}.` : ''}`.trim();
};
