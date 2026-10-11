import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

// Messages are read through `useT()` (flat keys of packages/shared); next-intl provides routing, locale and formatters.
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = (routing.locales as readonly string[]).includes(requested ?? '') ? (requested as string) : routing.defaultLocale;
  return { locale, messages: {}, timeZone: 'Africa/Algiers' };
});
