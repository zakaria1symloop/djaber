// `/` — landing (route map §3.1; Figma "PUB — Legal (CMS) · Landing & help · Meta data-deletion status", landing part).
// Server-rendered: `GET /cms/landing?lang` (optional: falls back to the catalogue texts), `GET /cms/features?lang`, `GET /plans`.
import type { CmsEntryDto } from '@djaber/shared';
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { LandingView } from '@/features/public/landing';
import type { PublicPlan } from '@/features/public/logic';
import { asOptional, asRead, pageLocale, publicGet, serverT } from '@/lib/public-fetch';
import { describe, pageMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ preview?: string }> };

const readHero = (locale: 'fr' | 'ar' | 'en', preview?: string) => publicGet<CmsEntryDto>('/cms/landing', { locale, query: { lang: locale, preview }, noStore: !!preview });

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = pageLocale((await params).locale);
  const { preview } = await searchParams;
  const t = serverT(locale);
  const hero = await readHero(locale, preview);
  return pageMetadata({ locale, path: '', title: t('public.meta.landing'), description: hero.ok ? describe(hero.data.body) : t('public.meta.landing.description'), noindex: !!preview });
}

export default async function LandingPage({ params, searchParams }: Props) {
  const locale = pageLocale((await params).locale);
  setRequestLocale(locale);
  const { preview } = await searchParams;
  const [hero, features, plans] = await Promise.all([
    readHero(locale, preview),
    publicGet<CmsEntryDto>('/cms/features', { locale, query: { lang: locale } }),
    publicGet<PublicPlan[]>('/plans', { locale }),
  ]);
  // a missing landing / features entry is not an error: the page keeps its catalogue texts (route map: optional blocks)
  return <LandingView hero={hero.ok ? hero.data : null} features={asOptional(features)} plans={asRead(plans)} />;
}
