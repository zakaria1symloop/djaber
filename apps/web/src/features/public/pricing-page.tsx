'use client';
// `/pricing` — Figma "PUB — Pricing page (plans · FAQ · CTA)" (1005:44755), PUB-02, AT-PUB-01: title "Un vendeur IA
// pour votre page, à partir de 0 DA", mono subtitle, Mensuel / Annuel −17 % toggle (`?cycle=yearly`, computed from the
// plans), plan cards (Populaire), note "1 crédit = 1 réponse texte · packs de crédits à partir de 450 DA", FAQ accordion
// (5 questions of `CmsEntry(pricing-faq)`). States: published · fallback banner · plans error · no FAQ.
import { formatNumber, type CmsEntryDto } from '@djaber/shared';
import { FaqAccordion, MarketingHeading, SegmentedControl } from '@djaber/ui';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { Cycle } from '@/features/billing/logic';
import { useT } from '@/lib/i18n';
import type { Read } from '@/lib/public-fetch';
import { bestYearlyDiscount, markdownSections, type PublicPlan } from './logic';
import { PricingCards } from './pricing-cards';
import { CmsBody, FallbackBanner, PreviewBanner, PublicError } from './shared';

export function PricingView({ plans, faq, minPack, initialCycle }: { plans: Read<PublicPlan[]>; faq: Read<CmsEntryDto | null>; minPack: number | null; initialCycle: Cycle }) {
  const t = useT();
  const search = useSearchParams();
  const [cycle, setCycle] = useState<Cycle>(initialCycle);
  const list = plans.ok ? plans.data : [];
  const pct = bestYearlyDiscount(list);
  const minPrice = list.length ? Math.min(...list.map((p) => p.priceMonthly)) : 0;
  const entry = faq.ok ? faq.data : null;
  const questions = entry ? markdownSections(entry.body).sections : [];
  const change = (c: Cycle) => {
    setCycle(c);
    const p = new URLSearchParams(search.toString());
    if (c === 'yearly') p.set('cycle', 'yearly');
    else p.delete('cycle');
    const qs = p.toString();
    // the cycle only changes the cards: the URL is updated in place (shareable, Back-safe) without a server round trip
    window.history.replaceState(window.history.state, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  };
  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center gap-5 px-4 py-12" data-testid="pricing-page">
      {entry?.preview ? <PreviewBanner /> : null}
      {entry?.fallback ? <FallbackBanner requested={entry.requestedLocale} /> : null}
      <MarketingHeading title={t('public.pricing.title', { price: formatNumber(minPrice) })} sub={t('public.pricing.sub')} />
      {plans.ok && list.some((p) => p.priceMonthly > 0) ? (
        <SegmentedControl<Cycle>
          label={t('public.pricing.cycle.label')}
          value={cycle}
          onChange={change}
          options={[
            { value: 'monthly', label: t('public.pricing.cycle.monthly') },
            { value: 'yearly', label: pct > 0 ? t('public.pricing.cycle.yearly', { pct }) : t('public.pricing.cycle.yearlyPlain') },
          ]}
        />
      ) : null}
      <section aria-label={t('public.pricing.plans')} className="w-full pt-2">
        {plans.ok ? <PricingCards plans={list} cycle={cycle} /> : <PublicError refId={plans.ref} />}
      </section>
      <p className="text-center ts-label-meta text-text-muted" data-testid="pricing-note">
        {minPack !== null ? t('public.pricing.note', { price: formatNumber(minPack) }) : t('public.pricing.noteNoPack')}
      </p>
      {!faq.ok ? (
        <div className="w-full max-w-[760px]">
          <PublicError refId={faq.ref} />
        </div>
      ) : questions.length ? (
        <section aria-labelledby="pricing-faq" className="flex w-full max-w-[760px] flex-col gap-3 pt-4">
          <h2 id="pricing-faq" className="sr-only">
            {entry?.title || t('public.pricing.faq')}
          </h2>
          <FaqAccordion data-testid="pricing-faq" items={questions.map((q, i) => ({ id: String(i), question: q.title, answer: <CmsBody body={q.body} className="flex flex-col gap-2" headingLevel={3} /> }))} />
        </section>
      ) : null}
    </div>
  );
}
