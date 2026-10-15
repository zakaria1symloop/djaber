'use client';
// `/` landing and `/features` (Figma "PUB — Legal (CMS) · Landing & help · Meta data-deletion status", landing part;
// PUB-04): hero from `CmsEntry(landing)` ("Votre vendeur IA sur Messenger & Instagram", Essai gratuit · Voir une démo),
// the 6 feature blocks of `CmsEntry(features)` (one `## ` section each), the plans of `GET /plans`. Full-bleed
// sections, designed content width (1120 px). States: published · locale fallback banner · section error (Réessayer).
import type { CmsEntryDto } from '@djaber/shared';
import type { HTMLAttributes, ReactNode } from 'react';
import { FeatureBlock, MarketingHeading, buttonClass } from '@djaber/ui';
import { formatNumber } from '@djaber/shared';
import { Link } from '@/i18n/navigation';
import { useT } from '@/lib/i18n';
import { markdownSections, type PublicPlan } from './logic';
import { PricingCards } from './pricing-cards';
import { CmsBody, FallbackBanner, PreviewBanner, PublicError } from './shared';

import type { Read } from '@/lib/public-fetch';

const Section = ({ children, className = '', ...rest }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLElement>) => (
  <section className={`w-full border-b border-line-hairline last:border-b-0 ${className}`} {...rest}>
    <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center gap-8 px-4 py-14 md:py-20">{children}</div>
  </section>
);

export function FeatureGrid({ entry }: { entry: CmsEntryDto }) {
  const { sections } = markdownSections(entry.body);
  return (
    <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="feature-blocks">
      {sections.map((s, i) => (
        <FeatureBlock key={s.title} index={String(i + 1).padStart(2, '0')} title={s.title} data-testid="feature-block">
          <CmsBody body={s.body} className="flex flex-col gap-2" headingLevel={3} />
        </FeatureBlock>
      ))}
    </div>
  );
}

export function LandingView({ hero, features, plans }: { hero: CmsEntryDto | null; features: Read<CmsEntryDto | null>; plans: Read<PublicPlan[]> }) {
  const t = useT();
  const minPrice = plans.ok && plans.data.length ? Math.min(...plans.data.map((p) => p.priceMonthly)) : 0;
  const fallbackFrom = [hero, features.ok ? features.data : null].find((e) => e?.fallback)?.requestedLocale;
  return (
    <div className="flex w-full flex-col" data-testid="landing">
      {fallbackFrom || hero?.preview ? (
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-2 px-4 pt-6">
          {hero?.preview ? <PreviewBanner /> : null}
          {fallbackFrom ? <FallbackBanner requested={fallbackFrom} /> : null}
        </div>
      ) : null}
      <Section data-testid="landing-hero">
        <MarketingHeading title={hero?.title || t('public.meta.landing')} />
        <div className="max-w-[640px] text-center">
          {hero?.body ? <CmsBody body={hero.body} className="flex flex-col gap-2 [&_p]:text-[15px]" /> : <p className="text-[15px] text-text-secondary">{t('public.meta.landing.description')}</p>}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/signup" className={buttonClass({ variant: 'primary' })} data-testid="landing-trial">
            {t('public.landing.cta.trial')}
          </Link>
          {/* no demo exists: the second CTA says where it leads (assumptions-log 2026-10-15) */}
          <Link href="/features" className={buttonClass({})} data-testid="landing-features">
            {t('public.landing.cta.features')}
          </Link>
        </div>
      </Section>
      <Section>
        <MarketingHeading level={2} title={features.ok && features.data ? features.data.title : t('public.landing.features.title')} />
        {!features.ok ? <PublicError refId={features.ref} /> : features.data ? <FeatureGrid entry={features.data} /> : null}
        <Link href="/features" className={buttonClass({ variant: 'ghost' })}>
          {t('public.landing.features.more')}
        </Link>
      </Section>
      <Section>
        <MarketingHeading level={2} title={t('public.landing.pricing.title', { price: formatNumber(minPrice) })} sub={t('public.pricing.sub')} />
        {!plans.ok ? <PublicError refId={plans.ref} /> : <PricingCards plans={plans.data} cycle="monthly" />}
        <Link href="/pricing" className={buttonClass({ variant: 'ghost' })}>
          {t('public.landing.pricing.cta')}
        </Link>
      </Section>
    </div>
  );
}

/** `/features`: the 6 blocks in full, then the trial CTA. */
export function FeaturesView({ entry }: { entry: CmsEntryDto }) {
  const t = useT();
  const { intro } = markdownSections(entry.body);
  return (
    <div className="flex w-full flex-col" data-testid="features-page">
      <Section>
        {entry.preview || entry.fallback ? (
          <div className="flex w-full flex-col gap-2">
            {entry.preview ? <PreviewBanner /> : null}
            {entry.fallback ? <FallbackBanner requested={entry.requestedLocale} /> : null}
          </div>
        ) : null}
        <MarketingHeading title={entry.title} />
        {intro ? <CmsBody body={intro} className="max-w-[640px] text-center" /> : null}
        <FeatureGrid entry={entry} />
        <Link href="/signup" className={buttonClass({ variant: 'primary' })}>
          {t('public.features.cta')}
        </Link>
      </Section>
    </div>
  );
}
