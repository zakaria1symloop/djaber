// `/account/deletion` — public account deletion page (route map §3.1, PUB-06, FL-22; Figma "PUB — Public account
// deletion page (djaber.ai/compte/suppression)"). The e-mail link of `POST /account-deletion/request` lands here with `?token=`.
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { AccountDeletionPage } from '@/features/public/account-deletion';
import { pageLocale, serverT } from '@/lib/public-fetch';
import { pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = pageLocale((await params).locale);
  const { token } = await searchParams;
  const t = serverT(locale);
  // a personal link (token) is never indexed
  return { ...pageMetadata({ locale, path: '/account/deletion', title: t('public.meta.accountDeletion'), description: t('public.meta.accountDeletion.description'), noindex: !!token }), referrer: 'no-referrer' };
}

export default async function Page({ params }: Props) {
  setRequestLocale(pageLocale((await params).locale));
  return (
    <Suspense>
      <AccountDeletionPage />
    </Suspense>
  );
}
