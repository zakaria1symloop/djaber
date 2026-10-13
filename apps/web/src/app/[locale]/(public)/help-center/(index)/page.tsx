// `/help-center` — public help centre (route map §3.1 public `/help`; the in-app help hub keeps `/help` inside
// (app), anonymous visitors of `/help` are sent here — assumptions-log M11 web-public). `GET /help/articles?q&category&lang`.
import type { HelpArticleDto } from '@djaber/shared';
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { PublicHelpCenter } from '@/features/public/help-center';
import { parseHelpQuery, searchable } from '@/features/public/logic';
import { asRead, pageLocale, publicGet, serverT } from '@/lib/public-fetch';
import { pageMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = pageLocale((await params).locale);
  const q = parseHelpQuery(await searchParams);
  const t = serverT(locale);
  // search result pages are not indexed (the categories and guides are)
  return pageMetadata({ locale, path: '/help-center', title: t('public.meta.help'), description: t('public.meta.help.description'), noindex: !!q.q });
}

export default async function HelpCenterPage({ params, searchParams }: Props) {
  const locale = pageLocale((await params).locale);
  setRequestLocale(locale);
  const query = parseHelpQuery(await searchParams);
  const filtering = searchable(query.q) || query.category !== null;
  const [all, results] = await Promise.all([
    publicGet<HelpArticleDto[]>('/help/articles', { locale, query: { lang: locale } }),
    filtering ? publicGet<HelpArticleDto[]>('/help/articles', { locale, query: { lang: locale, q: searchable(query.q) ? query.q : undefined, category: query.category ?? undefined } }) : Promise.resolve(null),
  ]);
  return <PublicHelpCenter query={query} all={asRead(all)} results={results ? asRead(results) : null} />;
}
