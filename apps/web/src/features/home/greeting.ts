// Home greeting (Figma ANA-01: "MARDI 7 OCTOBRE" + "Bonsoir, Zakaria"), computed in Africa/Algiers.
import { TIMEZONE } from '@djaber/shared';

/** Hour (0–23) in Africa/Algiers. */
export const algiersHour = (d: Date): number => Number(new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, hour: '2-digit', hour12: false }).format(d)) % 24;

/** "Bonjour" from 05:00 to 17:59, "Bonsoir" otherwise. */
export const greetingKey = (d: Date): 'home.greeting.morning' | 'home.greeting.evening' => {
  const h = algiersHour(d);
  return h >= 5 && h < 18 ? 'home.greeting.morning' : 'home.greeting.evening';
};

/** "mardi 7 octobre" — weekday + day + month, Latin digits in every locale. */
export const longDate = (d: Date, locale: string): string =>
  new Intl.DateTimeFormat(locale === 'ar' ? 'ar-DZ-u-nu-latn' : locale === 'en' ? 'en-GB' : 'fr-FR', { timeZone: TIMEZONE, weekday: 'long', day: 'numeric', month: 'long' }).format(d);
