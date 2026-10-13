// `/robots.txt` — the public site is crawlable; the app, the admin, personal links and dev pages are not (PUB-01 SEO).
import type { MetadataRoute } from 'next';
import { SITE_LOCALES, SITE_URL } from '@/lib/seo';

const PRIVATE = ['/admin', '/home', '/inbox', '/orders', '/settings', '/onboarding', '/s/', '/agent-test/', '/dev/', '/meta/', '/status/confirm/', '/status/unsubscribe/'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: SITE_LOCALES.flatMap((l) => PRIVATE.map((p) => `/${l}${p}`)) }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
