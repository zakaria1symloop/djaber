import { redirect } from '@/i18n/navigation';

// /settings opens the first entry of the sub-nav.
export default async function SettingsIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: '/settings/profile', locale });
}
