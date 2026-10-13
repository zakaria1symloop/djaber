// `/help/[slug]` — one public guide (route map §3.1 `/help/[slug]`, PUB-04; the URL of the admin preview link too).
// `GET /help/articles/:slug?lang` — FR fallback banner, 404 when unknown / unpublished (real HTTP 404: no streaming
// boundary on this route), guides of the same category. `?preview=<token>` reads the unpublished entry through
// `GET /cms/:key?preview=` (admin signed link, 24 h), never cached nor indexed. The in-app help keeps `/help`.
import type { CmsEntryDto, HelpArticleDto } from '@djaber/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { PublicHelpArticle } from '@/features/public/help-center';
import { isCmsKey } from '@/features/public/logic';
import { PublicErrorPage } from '@/features/public/shared';
import { pageLocale, publicGet, type PublicResult } from '@/lib/public-fetch';
import { describe, pageMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ preview?: string }> };
type Article = HelpArticleDto & { preview?: boolean };

async function read(key: string, locale: 'fr' | 'ar' | 'en', preview?: string): Promise<PublicResult<Article>> {
  if (!preview) return publicGet<HelpArticleDto>(`/help/articles/${encodeURIComponent(key)}`, { locale, query: { lang: locale } });
  const r = await publicGet<CmsEntryDto>(`/cms/${encodeURIComponent(key)}`, { locale, query: { lang: locale, preview }, noStore: true });
  if (!r.ok) return r;
  if (r.data.type !== 'help') return { ok: false, status: 404, code: 'NOT_FOUND', ref: '—' };
  const e = r.data;
  return { ok: true, data: { key: e.key, category: e.category, locale: e.locale, requestedLocale: e.requestedLocale, fallback: e.fallback, title: e.title, excerpt: '', body: e.body, version: e.version, publishedAt: e.publishedAt, contexts: [], preview: e.preview } };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale = pageLocale(raw);
  const { preview } = await searchParams;
  const key = decodeURIComponent(slug);
  const r = isCmsKey(key) ? await read(key, locale, preview) : null;
  if (!r?.ok) return pageMetadata({ locale, path: `/help/${slug}`, title: '404', description: '', noindex: true });
  return pageMetadata({ locale, path: `/help/${slug}`, title: r.data.title, description: r.data.excerpt || describe(r.data.body), noindex: !!preview || r.data.fallback });
}

export default async function HelpArticlePage({ params, searchParams }: Props) {
  const { locale: raw, slug } = await params;
  const locale = pageLocale(raw);
  setRequestLocale(locale);
  const { preview } = await searchParams;
  const key = decodeURIComponent(slug);
  if (!isCmsKey(key)) notFound();
  const r = await read(key, locale, preview);
  if (!r.ok && (r.status === 404 || r.status === 422 || r.status === 410)) notFound();
  if (!r.ok) return <PublicErrorPage refId={r.ref} />;
  const related = r.data.category ? await publicGet<HelpArticleDto[]>('/help/articles', { locale, query: { lang: locale, category: r.data.category } }) : null;
  return <PublicHelpArticle article={r.data} related={related?.ok ? related.data.filter((a) => a.key !== r.data.key).slice(0, 5) : []} />;
}
