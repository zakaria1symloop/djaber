// `/pricing` — Figma "PUB — Pricing page (plans · FAQ · CTA)" (route map §3.1, PUB-02, AT-PUB-01).
// Server-rendered: `GET /plans`, `GET /cms/pricing-faq?lang`, `GET /credit-packs` (cheapest pack of the note).
import type { CmsEntryDto } from '@djaber/shared';
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { cheapestPack, parseCycleParam, type PublicPack, type PublicPlan } from '@/features/public/logic';
import { PricingView } from '@/features/public/pricing-page';
import { asOptional, asRead, pageLocale, publicGet, serverT } from '@/lib/public-fetch';
import { pageMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ cycle?: string | string[]; preview?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = pageLocale((await params).locale);
  const t = serverT(locale);
  return pageMetadata({ locale, path: '/pricing', title: t('public.meta.pricing'), description: t('public.meta.pricing.description') });
}

export default async function PricingPage({ params, searchParams }: Props) {
  const locale = pageLocale((await params).locale);
  setRequestLocale(locale);
  const sp = await searchParams;
  const [plans, faq, packs] = await Promise.all([
    publicGet<PublicPlan[]>('/plans', { locale }),
    publicGet<CmsEntryDto>('/cms/pricing-faq', { locale, query: { lang: locale, preview: sp.preview }, noStore: !!sp.preview }),
    publicGet<PublicPack[]>('/credit-packs', { locale }),
  ]);
  return <PricingView plans={asRead(plans)} faq={asOptional(faq)} minPack={packs.ok ? cheapestPack(packs.data) : null} initialCycle={parseCycleParam(sp.cycle)} />;
}
