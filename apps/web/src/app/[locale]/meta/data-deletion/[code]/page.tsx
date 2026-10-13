// /meta/data-deletion/[code] — Figma "PUB — Legal (CMS) · Landing & help · Meta data-deletion status" (right column).
// Public status page of a Meta data-deletion request (MSG-08, PUB-05): no navigation, no session required, FR / AR / EN
// by the path or `?lang=` (PUB-05 "FR/AR/EN par ?lang=": `?lang=ar` opens the Arabic page). Never indexed.
import { isAppLocale } from '@djaber/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DataDeletionStatus } from '@/features/notifications/data-deletion-status';
import { redirect } from '@/i18n/navigation';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DataDeletionPage({ params, searchParams }: { params: Promise<{ code: string; locale: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { code, locale } = await params;
  const { lang } = await searchParams;
  if (lang && isAppLocale(lang) && lang !== locale) redirect({ href: `/meta/data-deletion/${code}`, locale: lang });
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Suspense>
        <DataDeletionStatus code={decodeURIComponent(code)} />
      </Suspense>
    </main>
  );
}
