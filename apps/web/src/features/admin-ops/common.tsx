'use client';
// Shared pieces of the ADM-12/13/14 screens: localized text fields (FR / AR / EN, admin resources edit every locale at
// once — api-contract §1.1), duration label, offline / write-disabled reason and the localized pick of an `{fr, ar, en}`.
import type { OpsLocalizedText } from '@djaber/shared';
import { Field, Input, Textarea } from '@djaber/ui';
import { useOffline } from '@/features/orders/offline';
import { usePlatform } from '@/features/admin/platform';
import type { PlatformPermission } from '@djaber/shared';
import { useLocaleCode, useT } from '@/lib/i18n';
import { durationKey, durationParams, durationParts } from './logic';

export const LOCALES = ['fr', 'ar', 'en'] as const;

/** Text of the viewer's locale, French fallback. */
export function useLocalized() {
  const locale = useLocaleCode() as 'fr' | 'ar' | 'en';
  return (v: OpsLocalizedText | null | undefined): string => (v ? (v[locale] || v.fr) : '');
}

export function useDuration() {
  const t = useT();
  return (minutes: number) => {
    const p = durationParts(minutes);
    return t(durationKey(p), durationParams(p));
  };
}

/**
 * Write control state: hidden when the role lacks the key (the page stays readable for every platform role, 02 §2.3),
 * disabled with the offline reason when the network is down.
 */
export function useWrite(permission: PlatformPermission) {
  const t = useT();
  const { can } = usePlatform();
  const offline = useOffline();
  const allowed = can(permission);
  return { allowed, offline, disabledReason: offline ? t('banner.offline') : undefined };
}

export function LocalizedFields({
  label,
  value,
  onChange,
  multiline,
  error,
  required,
  idPrefix,
}: {
  label: string;
  value: OpsLocalizedText;
  onChange: (v: OpsLocalizedText) => void;
  multiline?: boolean;
  error?: string;
  required?: boolean;
  idPrefix: string;
}) {
  const t = useT();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 ts-label-micro uppercase text-text-muted">{label}</legend>
      {LOCALES.map((l) => {
        const id = `${idPrefix}-${l}`;
        const v = value[l] ?? '';
        const set = (s: string) => onChange({ ...value, [l]: s });
        return (
          <Field key={l} label={t(`adminOps.locale.${l}`)} htmlFor={id} required={required && l === 'fr'} error={l === 'fr' ? error : undefined}>
            {multiline ? (
              <Textarea id={id} rows={2} dir={l === 'ar' ? 'rtl' : 'ltr'} value={v} onChange={(e) => set(e.target.value)} />
            ) : (
              <Input id={id} dir={l === 'ar' ? 'rtl' : 'ltr'} value={v} onChange={(e) => set(e.target.value)} />
            )}
          </Field>
        );
      })}
    </fieldset>
  );
}

/** `{ fr, ar?, en? }` without empty optional locales (the API refuses blank strings only for `fr`). */
export const cleanLocalized = (v: OpsLocalizedText): OpsLocalizedText => ({
  fr: v.fr.trim(),
  ...(v.ar?.trim() ? { ar: v.ar.trim() } : {}),
  ...(v.en?.trim() ? { en: v.en.trim() } : {}),
});
export const EMPTY_LOCALIZED: OpsLocalizedText = { fr: '', ar: '', en: '' };

/** "Sofiane B." — first name + initial of the last name (Figma admin rows). */
export const userName = (u: { firstName: string; lastName: string } | null | undefined): string =>
  u ? `${u.firstName}${u.lastName ? ` ${u.lastName.charAt(0)}.` : ''}`.trim() : '—';
