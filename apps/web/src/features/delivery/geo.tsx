'use client';
// Wilaya / commune / stop-desk pickers fed by `/geo/*` and `/delivery/stopdesks` (02-next-route-map §5 "Combobox
// variants: WilayaCombobox, CommuneCombobox wilayaId"). Used by the order form, the address dialog and the client form.
import { Combobox } from '@djaber/ui';
import { useLocaleCode, useT } from '@/lib/i18n';
import { useCommunes, useGeoWilayas, useStopdesks } from './api';
import type { Commune, Wilaya } from './contracts';

/** "19 · Sétif" (Arabic name in the Arabic UI) */
export const wilayaLabel = (w: Pick<Wilaya, 'code' | 'nameFr' | 'nameAr'>, locale: string) => `${w.code} · ${locale === 'ar' ? w.nameAr : w.nameFr}`;
export const communeLabel = (c: Pick<Commune, 'nameFr' | 'nameAr'>, locale: string) => (locale === 'ar' ? c.nameAr : c.nameFr);

export function WilayaCombobox({ id, value, onChange, invalid, disabled, clearable }: { id?: string; value: number | null; onChange: (id: number | null, w: Wilaya | null) => void; invalid?: boolean; disabled?: boolean; clearable?: boolean }) {
  const t = useT();
  const locale = useLocaleCode();
  const q = useGeoWilayas();
  const list = q.data ?? [];
  return (
    <Combobox
      id={id}
      value={value === null ? null : String(value)}
      onChange={(v) => {
        const w = v ? (list.find((x) => String(x.id) === v) ?? null) : null;
        onChange(w ? w.id : null, w);
      }}
      options={list.map((w) => ({ value: String(w.id), label: wilayaLabel(w, locale), hint: locale === 'ar' ? w.nameFr : w.nameAr }))}
      placeholder={t('geo.wilaya.placeholder')}
      searchPlaceholder={t('geo.wilaya.search')}
      emptyLabel={q.isPending ? t('common.loading') : t('geo.empty')}
      clearLabel={clearable ? t('geo.clear') : undefined}
      loading={q.isPending}
      invalid={invalid}
      disabled={disabled}
    />
  );
}

export function CommuneCombobox({ id, wilayaId, value, onChange, invalid, disabled }: { id?: string; wilayaId: number | null; value: number | null; onChange: (id: number | null, c: Commune | null) => void; invalid?: boolean; disabled?: boolean }) {
  const t = useT();
  const locale = useLocaleCode();
  const q = useCommunes(wilayaId);
  const list = q.data ?? [];
  return (
    <Combobox
      id={id}
      value={value === null ? null : String(value)}
      onChange={(v) => {
        const c = v ? (list.find((x) => String(x.id) === v) ?? null) : null;
        onChange(c ? c.id : null, c);
      }}
      options={list.map((c) => ({ value: String(c.id), label: communeLabel(c, locale), hint: c.postalCode ?? undefined }))}
      placeholder={wilayaId ? t('geo.commune.placeholder') : t('geo.commune.pickWilaya')}
      searchPlaceholder={t('geo.commune.search')}
      emptyLabel={q.isPending && wilayaId ? t('common.loading') : t('geo.empty')}
      loading={q.isPending && !!wilayaId}
      invalid={invalid}
      disabled={disabled || !wilayaId}
    />
  );
}

/** Stop-desk agencies of the commune (courier `CourierStopdesk`); empty list until a courier is connected (M6). */
export function StopdeskCombobox({ id, communeId, value, onChange, invalid, disabled }: { id?: string; communeId: number | null; value: string | null; onChange: (id: string | null, name: string | null) => void; invalid?: boolean; disabled?: boolean }) {
  const t = useT();
  const q = useStopdesks(communeId);
  const list = q.data ?? [];
  return (
    <Combobox
      id={id}
      value={value}
      onChange={(v, o) => onChange(v, o?.label ?? null)}
      options={list.map((s) => ({ value: s.id, label: s.name, hint: s.provider }))}
      placeholder={t('geo.stopdesk.placeholder')}
      searchPlaceholder={t('geo.stopdesk.search')}
      emptyLabel={q.isPending && communeId ? t('common.loading') : t('geo.stopdesk.empty')}
      clearLabel={t('geo.clear')}
      invalid={invalid}
      disabled={disabled || !communeId}
    />
  );
}
