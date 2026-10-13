import { redirect } from '@/i18n/navigation';

// /settings/integrations opens its first tab (02-next-route-map: "/settings/integrations redirects to sheets").
export default async function IntegrationsIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: '/settings/integrations/sheets', locale });
}
