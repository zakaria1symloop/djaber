import { redirect } from '@/i18n/navigation';

// `/` inside a locale: the merchant home (the (app) layout redirects to /login without a session).
export default async function LocaleIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: '/home', locale });
}
