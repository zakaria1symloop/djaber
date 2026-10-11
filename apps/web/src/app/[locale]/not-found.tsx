'use client';
import { Page404 } from '@/components/global-states';
import { useLocaleCode } from '@/lib/i18n';

export default function NotFound() {
  const locale = useLocaleCode();
  return <Page404 homeHref={`/${locale}/home`} />;
}
