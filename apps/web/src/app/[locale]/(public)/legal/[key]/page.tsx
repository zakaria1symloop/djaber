// `/legal/[key]` — legal documents (`terms`, `privacy`, `account_deletion`, `content_rules`) and CMS pages (`cookies`,
// `data-deletion`), route map §3.1, PUB-03 `/legal/:slug?lang=`, AT-PUB-02. Server-rendered `GET /cms/:key?lang&preview`:
// `?lang=` picks the document language (FR · AR · EN tabs; default = the interface language), a missing translation
// is served in French with the banner; unpublished / unknown ⇒ real HTTP 404 (no streaming boundary on this route);
// `?preview=<token>` (admin signed link, 24 h) ⇒ unpublished content with the preview banner, never cached nor indexed.
import { isAppLocale, type AppLocale, type CmsEntryDto } from '@djaber/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { LegalView } from '@/features/public/legal-page';
import { isCmsKey, PUBLIC_CMS_TYPES } from '@/features/public/logic';
import { PublicErrorPage } from '@/features/public/shared';
import { pageLocale, publicGet } from '@/lib/public-fetch';
import { describe, pageMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string; key: string }>; searchParams: Promise<{ lang?: string; preview?: string }> };

const read = (key: string, locale: AppLocale, lang: AppLocale, preview?: string) =>
  publicGet<CmsEntryDto>(`/cms/${encodeURIComponent(key)}`, { locale, query: { lang, preview }, noStore: !!preview });
const servable = (e: CmsEntryDto) => (PUBLIC_CMS_TYPES as readonly string[]).includes(e.type);
const docLang = (lang: string | undefined, locale: AppLocale): AppLocale => (lang && isAppLocale(lang) ? lang : locale);

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale: raw, key } = await params;
  const locale = pageLocale(raw);
  const { lang, preview } = await searchParams;
  const r = isCmsKey(key) ? await read(key, locale, docLang(lang, locale), preview) : null;
  if (!r?.ok || !servable(r.data)) return pageMetadata({ locale, path: `/legal/${key}`, title: '404', description: '', noindex: true });
  return pageMetadata({ locale, path: `/legal/${key}`, title: r.data.title, description: describe(r.data.body), noindex: !!preview || !!lang || r.data.fallback });
}

export default async function LegalPage({ params, searchParams }: Props) {
  const { locale: raw, key } = await params;
  const locale = pageLocale(raw);
  setRequestLocale(locale);
  const { lang, preview } = await searchParams;
  if (!isCmsKey(key)) notFound();
  const r = await read(key, locale, docLang(lang, locale), preview);
  if (!r.ok && (r.status === 404 || r.status === 422 || r.status === 410)) notFound();
  if (!r.ok) return <PublicErrorPage refId={r.ref} />;
  if (!servable(r.data)) notFound();
  return <LegalView entry={r.data} previewToken={r.data.preview ? preview : undefined} />;
}
