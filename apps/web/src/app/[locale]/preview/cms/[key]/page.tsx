// `/preview/cms/[key]?preview=<token>` — target of the admin signed preview link of a `CmsEntry(type=page)`
// (`GET /admin/cms/:id/preview-link`, ADM-06): opens the public page that shows that entry with the same token.
import { notFound } from 'next/navigation';
import { redirect } from '@/i18n/navigation';
import { isCmsKey } from '@/features/public/logic';

const PAGE_OF: Record<string, string> = { landing: '/', features: '/features', 'pricing-faq': '/pricing' };

export default async function CmsPreviewRedirect({ params, searchParams }: { params: Promise<{ locale: string; key: string }>; searchParams: Promise<{ preview?: string }> }) {
  const { locale, key } = await params;
  const { preview } = await searchParams;
  if (!isCmsKey(key)) notFound();
  const path = PAGE_OF[key] ?? `/legal/${key}`;
  redirect({ href: preview ? `${path}?preview=${encodeURIComponent(preview)}` : path, locale });
}
