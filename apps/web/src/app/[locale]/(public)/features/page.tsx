// `/features` — the 6 feature blocks of `CmsEntry(features)` (route map §3.1, PUB-04). Server-rendered.
import type { CmsEntryDto } from '@djaber/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { FeaturesView } from '@/features/public/landing';
import { PublicErrorPage } from '@/features/public/shared';
import { pageLocale, publicGet, serverT } from '@/lib/public-fetch';
import { describe, pageMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ preview?: string }> };

const read = (locale: 'fr' | 'ar' | 'en', preview?: string) => publicGet<CmsEntryDto>('/cms/features', { locale, query: { lang: locale, preview }, noStore: !!preview });

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = pageLocale((await params).locale);
  const { preview } = await searchParams;
  const r = await read(locale, preview);
  return pageMetadata({ locale, path: '/features', title: r.ok ? r.data.title : serverT(locale)('public.meta.features'), description: r.ok ? describe(r.data.body) : '', noindex: !!preview || !r.ok });
}

export default async function FeaturesPage({ params, searchParams }: Props) {
  const locale = pageLocale((await params).locale);
  setRequestLocale(locale);
  const { preview } = await searchParams;
  const r = await read(locale, preview);
  if (!r.ok && r.status === 404) notFound();
  if (!r.ok) return <PublicErrorPage refId={r.ref} />;
  return <FeaturesView entry={r.data} />;
}
