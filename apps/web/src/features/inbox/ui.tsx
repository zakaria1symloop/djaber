'use client';
// Small display pieces shared by the inbox panes: ages ("2 MIN", "LUN."), platform badge, names, a ticking clock.
import { formatDate, formatPhoneDz, TIMEZONE, type AppLocale } from '@djaber/shared';
import { cn, Ltr } from '@djaber/ui';
import { Facebook, Instagram } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { UserRef } from '@/lib/contracts';
import { useLocaleCode, useT } from '@/lib/i18n';
import type { TFunction } from '@/lib/i18n';
import type { ChannelRef, ClientRef, Platform } from './contracts';
import { handoffReason } from './ai-run-logic';
import { dayKey, dayLabelKind } from './logic';

/** `now`, refreshed every 30 s: ages and the 24 h window follow the clock without a refetch. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

const weekday = (iso: string, locale: string) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : locale, { timeZone: TIMEZONE, weekday: 'short' }).format(new Date(iso));

/** Row age as in the frame: "2 MIN", "1 H", "LUN." (this week), then the date. */
export const shortAge = (iso: string | null | undefined, t: TFunction, locale: string, now: number): string => {
  if (!iso) return '';
  const diff = Math.max(0, now - Date.parse(iso));
  const min = Math.floor(diff / 60_000);
  if (min < 1) return t('inbox.age.now');
  if (min < 60) return t('inbox.age.min', { count: min });
  if (min < 24 * 60) return t('inbox.age.hour', { count: Math.floor(min / 60) });
  if (min < 7 * 24 * 60) return weekday(iso, locale);
  return formatDate(iso, locale as AppLocale);
};

export const dayLabel = (day: string, t: TFunction, locale: string, now: number): string => {
  const kind = dayLabelKind(day, now);
  if (kind === 'today') return t('common.today');
  if (kind === 'yesterday') return t('common.yesterday');
  // noon UTC of that calendar day falls on the same day in Africa/Algiers
  return formatDate(`${day}T12:00:00.000Z`, locale as AppLocale);
};
export const sameDay = (a: string, b: number) => dayKey(a) === dayKey(b);

/** Wraps an interpolated value (a name, a French reason inside an Arabic sentence) in bidi isolates: the sentence keeps its order. */
export const isolate = (value: string): string => (value ? `\u2068${value}\u2069` : value);

/**
 * Reason of a needs-human conversation in words: a known code of the AI pipeline (`refund`, `unclear_streak`,
 * `keyword:avocat`…) gets its label, anything else is shown as the server wrote it.
 */
export const handoffLabel = (t: TFunction, raw: string | null | undefined): string => {
  const r = handoffReason(raw);
  if (!r) return '';
  if (r.kind === 'transfer') return r.detail ?? t('inbox.handoff.reason.transfer');
  const label = t(`inbox.handoff.reason.${r.kind}`);
  return r.detail ? `${label} · ${r.detail}` : label;
};

export const userName = (u: Pick<UserRef, 'firstName' | 'lastName'> | null | undefined): string => (u ? `${u.firstName} ${u.lastName}`.trim() : '');
/** "Nadia F." */
export const shortUserName = (u: Pick<UserRef, 'firstName' | 'lastName'> | null | undefined): string => (u ? `${u.firstName} ${u.lastName ? `${u.lastName[0]}.` : ''}`.trim() : '');

export function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  const Icon = platform === 'instagram' ? Instagram : Facebook;
  return <Icon aria-hidden className={cn('size-3.5 shrink-0', className)} />;
}

/** "FB" / "IG" mono badge of a row when every channel is listed. */
export function ChannelBadge({ channel, className }: { channel: Pick<ChannelRef, 'platform' | 'name'>; className?: string }) {
  const t = useT();
  return (
    <span title={`${channel.name} · ${t(`enum.Channel.platform.${channel.platform}`)}`} className={cn('inline-flex items-center gap-1 ts-label-micro text-text-muted', className)}>
      <PlatformIcon platform={channel.platform} className="size-3" />
      <span className="max-w-24 truncate" dir="auto">
        {channel.name}
      </span>
    </span>
  );
}

export function Phone({ value, className }: { value: string | null | undefined; className?: string }) {
  if (!value) return <span className="text-text-muted">—</span>;
  return <Ltr className={cn('tabular-nums', className)}>{formatPhoneDz(value)}</Ltr>;
}

/** Name shown for the customer of a conversation: the client card, else the Meta profile name. */
export const clientName = (client: Pick<ClientRef, 'name'> | null | undefined, fallback: string): string => client?.name?.trim() || fallback;

export function useLocale(): AppLocale {
  return useLocaleCode() as AppLocale;
}
