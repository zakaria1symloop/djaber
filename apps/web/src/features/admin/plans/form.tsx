'use client';
// ADM-04 plan form state shared by DLG "Créer un plan" and the inline editor "Modifier « … » (Plan.version n → n+1)".
// −1 = illimité; at least one limit > 0 (AT-BIL-09); yearly discount shown automatically.
import { PLAN_FEATURES, type AdminCreatePlanInput, type PlanAdminDto } from '@djaber/shared';
import { Field, Input, NumberInput } from '@djaber/ui';
import { CheckChip } from '@djaber/ui';
import { useT } from '@/lib/i18n';

export type PlanDraft = {
  slug: string;
  nameFr: string;
  nameAr: string;
  nameEn: string;
  description: string;
  priceMonthly: string;
  priceYearly: string;
  trialDays: string;
  sortOrder: string;
  maxPages: string;
  maxAgents: string;
  maxProducts: string;
  maxConversationsPerMonth: string;
  maxMembers: string;
  monthlyCredits: string;
  maxApiKeys: string;
  maxWebhooks: string;
  syncHistoryDays: string;
  features: string[];
  isActive: boolean;
  isFeatured: boolean;
  isVisible: boolean;
};

export const LIMIT_KEYS = ['maxPages', 'maxAgents', 'maxProducts', 'maxConversationsPerMonth', 'maxMembers', 'monthlyCredits'] as const;

export const EMPTY_PLAN: PlanDraft = {
  slug: '',
  nameFr: '',
  nameAr: '',
  nameEn: '',
  description: '',
  priceMonthly: '',
  priceYearly: '',
  trialDays: '',
  sortOrder: '',
  maxPages: '',
  maxAgents: '',
  maxProducts: '',
  maxConversationsPerMonth: '',
  maxMembers: '',
  monthlyCredits: '',
  maxApiKeys: '',
  maxWebhooks: '',
  syncHistoryDays: '',
  features: [],
  isActive: true,
  isFeatured: false,
  isVisible: true,
};

const s = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));
export const draftOf = (p: PlanAdminDto): PlanDraft => ({
  slug: p.slug,
  nameFr: p.nameI18n?.fr ?? p.name,
  nameAr: p.nameI18n?.ar ?? '',
  nameEn: p.nameI18n?.en ?? '',
  description: p.descriptionI18n?.fr ?? p.description ?? '',
  priceMonthly: s(p.priceMonthly),
  priceYearly: s(p.priceYearly),
  trialDays: s(p.trialDays),
  sortOrder: s(p.sortOrder),
  maxPages: s(p.limits.maxPages),
  maxAgents: s(p.limits.maxAgents),
  maxProducts: s(p.limits.maxProducts),
  maxConversationsPerMonth: s(p.limits.maxConversationsPerMonth),
  maxMembers: s(p.limits.maxMembers),
  monthlyCredits: s(p.limits.monthlyCredits),
  maxApiKeys: s(p.maxApiKeys),
  maxWebhooks: s(p.maxWebhooks),
  syncHistoryDays: s(p.syncHistoryDays),
  features: [...(p.features ?? p.limits.features ?? [])],
  isActive: p.isActive,
  isFeatured: p.isFeatured,
  isVisible: p.isVisible,
});

/** "-1" / "12 000" → number ("" → undefined). */
const num = (v: string) => {
  const x = v.trim().replace(/\s/g, '');
  if (x === '') return undefined;
  const n = Number(x);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
};

export function toPlanInput(d: PlanDraft): Omit<AdminCreatePlanInput, 'slug'> & { slug?: string } {
  return {
    slug: d.slug.trim().toLowerCase() || undefined,
    name: { fr: d.nameFr.trim(), ...(d.nameAr.trim() ? { ar: d.nameAr.trim() } : {}), ...(d.nameEn.trim() ? { en: d.nameEn.trim() } : {}) },
    ...(d.description.trim() ? { description: { fr: d.description.trim() } } : {}),
    priceMonthly: num(d.priceMonthly) ?? 0,
    priceYearly: num(d.priceYearly) ?? 0,
    trialDays: num(d.trialDays),
    sortOrder: num(d.sortOrder),
    maxPages: num(d.maxPages) ?? 0,
    maxAgents: num(d.maxAgents) ?? 0,
    maxProducts: num(d.maxProducts) ?? 0,
    maxConversationsPerMonth: num(d.maxConversationsPerMonth) ?? 0,
    maxMembers: num(d.maxMembers) ?? 0,
    monthlyCredits: num(d.monthlyCredits) ?? 0,
    maxApiKeys: num(d.maxApiKeys),
    maxWebhooks: num(d.maxWebhooks),
    syncHistoryDays: num(d.syncHistoryDays),
    features: d.features,
    isVisible: d.isVisible,
    isFeatured: d.isFeatured,
  };
}

/** AT-BIL-09: every limit 0 ⇒ invalid (−1 counts as > 0: unlimited). */
export const hasOneLimit = (d: PlanDraft) => LIMIT_KEYS.some((k) => {
  const n = num(d[k]);
  return n !== undefined && n !== 0;
});

/** "−17 %" — yearly price vs 12 × monthly. */
export const yearlyDiscount = (d: PlanDraft): number | null => {
  const m = num(d.priceMonthly);
  const y = num(d.priceYearly);
  if (!m || !y || m <= 0) return null;
  return Math.round((1 - y / (m * 12)) * 100);
};

/** Signed integer field (−1 = illimité). */
export function SignedField({ id, label, value, onChange, error, required, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string; required?: boolean; hint?: string }) {
  return (
    <Field label={label} htmlFor={id} error={error} required={required} hint={hint}>
      <Input id={id} inputMode="numeric" dir="ltr" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d-]/g, '').replace(/(?!^)-/g, ''))} />
    </Field>
  );
}

export function MoneyField({ id, label, value, onChange, error, required, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string; required?: boolean; hint?: string }) {
  return (
    <Field label={label} htmlFor={id} error={error} required={required} hint={hint}>
      <NumberInput id={id} value={value} onValueChange={onChange} />
    </Field>
  );
}

export function FeatureChips({ value, onChange, disabled }: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  const t = useT();
  return (
    <div role="group" aria-label={t('admin.plans.form.features')} className="flex flex-wrap gap-2">
      {PLAN_FEATURES.map((k) => (
        <CheckChip key={k} name={`feature-${k}`} checked={value.includes(k)} disabled={disabled} onChange={(on) => onChange(on ? [...value, k] : value.filter((x) => x !== k))}>
          <span className="font-mono text-[12px]">{k}</span>
        </CheckChip>
      ))}
    </div>
  );
}
