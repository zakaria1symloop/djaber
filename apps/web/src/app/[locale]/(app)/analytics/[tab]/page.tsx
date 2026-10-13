'use client';
// /analytics/[tab] — Figma "ANA-02b — Analytics — tabs …" (conversations · responses · consumption · agents · channels ·
// products · orders · delivery); `overview` is `/analytics`; an unknown tab is the localized 404.
import { useParams } from 'next/navigation';
import { Page404 } from '@/components/global-states';
import { DETAIL_TABS } from '@/features/analytics/tabs/detail';
import { OverviewTab } from '@/features/analytics/tabs/overview';
import { useLocaleCode } from '@/lib/i18n';

export default function Page() {
  const { tab } = useParams<{ tab: string }>();
  const locale = useLocaleCode();
  if (tab === 'overview') return <OverviewTab />;
  const View = DETAIL_TABS[tab as keyof typeof DETAIL_TABS];
  return View ? <View /> : <Page404 homeHref={`/${locale}/home`} />;
}
