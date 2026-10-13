// Pure helpers of Settings › Intégrations (unit-tested in logic.spec.ts): journal times and delivery result lines.
import { formatDateTime, formatNumber, type WebhookDeliveryDto } from '@djaber/shared';
import type { TFunction } from '@/lib/i18n';

export type DeliveryTone = 'success' | 'danger' | 'warning' | 'neutral';
type Locale = 'fr' | 'ar' | 'en';

const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

/** YYYY-MM-DD of an instant in Africa/Algiers. */
export const algiersDay = day;

/** "10:58" today, "hier 18:03" yesterday, otherwise the full date and time (Africa/Algiers). */
export function journalTime(iso: string, locale: Locale, t: TFunction, now = new Date()): string {
  const d = new Date(iso);
  const hm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Algiers', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  if (day(d) === day(now)) return hm;
  if (day(d) === day(new Date(now.getTime() - 86_400_000))) return t('settings.integrations.webhooks.journal.yesterday', { time: hm });
  return formatDateTime(d, locale);
}

/** "200 · 142 ms" · "502 · tentative 7/7" · "en attente" · "502 · nouvel essai 14:05 · tentative 2/7". */
export function deliveryResult(
  d: Pick<WebhookDeliveryDto, 'status' | 'responseCode' | 'durationMs' | 'attempt' | 'maxAttempts' | 'error' | 'nextAttemptAt'>,
  t: TFunction,
  locale: Locale,
  now = new Date(),
): { text: string; tone: DeliveryTone } {
  const attempt = t('settings.integrations.webhooks.journal.attempt', { attempt: d.attempt, max: d.maxAttempts });
  if (d.status === 'success') return { text: `${d.responseCode ?? 200} · ${formatNumber(d.durationMs ?? 0)} ms`, tone: 'success' };
  const code = d.responseCode ? String(d.responseCode) : d.error ? t('settings.integrations.webhooks.journal.noResponse') : null;
  if (d.status === 'pending') {
    if (d.attempt === 0 || !d.nextAttemptAt) return { text: t('settings.integrations.webhooks.journal.pending'), tone: 'neutral' };
    return { text: `${code ? `${code} · ` : ''}${t('settings.integrations.webhooks.journal.retryAt', { time: journalTime(d.nextAttemptAt, locale, t, now) })} · ${attempt}`, tone: 'warning' };
  }
  return { text: `${code ? `${code} · ` : ''}${attempt}`, tone: 'danger' };
}
