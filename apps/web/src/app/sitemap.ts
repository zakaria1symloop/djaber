// `/sitemap.xml` — the indexable public pages in fr / ar / en with their hreflang alternates (PUB-01 SEO).
// Help guides are listed from `GET /help/articles` when the API answers (the static pages are listed regardless).
import type { MetadataRoute } from 'next';
import type { HelpArticleDto } from '@djaber/shared';
import { publicGet } from '@/lib/public-fetch';
import { languageAlternates, PUBLIC_PATHS, SITE_LOCALES, SITE_URL } from '@/lib/seo';

export const dynamic = 'force-dynamic';

const abs = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, `${SITE_URL}${v}`]));

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const guides = await publicGet<HelpArticleDto[]>('/help/articles', { locale: 'fr', query: { lang: 'fr' } });
  const paths = [...PUBLIC_PATHS, ...(guides.ok ? guides.data.map((g) => `/help/${encodeURIComponent(g.key)}`) : [])];
  return paths.flatMap((path) =>
    SITE_LOCALES.map((l) => ({
      url: `${SITE_URL}/${l}${path}`,
      changeFrequency: path === '' || path === '/pricing' ? ('weekly' as const) : ('monthly' as const),
      priority: path === '' ? 1 : path === '/pricing' || path === '/features' ? 0.8 : 0.5,
      alternates: { languages: abs(languageAlternates(path)) },
    })),
  );
}
