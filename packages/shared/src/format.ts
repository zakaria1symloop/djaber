// CLAUDE.md rule 11 + 08-coder-playbook §6: integer DZD, Latin digits, thin-space thousands, Africa/Algiers.
export const TIMEZONE = 'Africa/Algiers';
const THIN = ' ';

export const formatNumber = (n: number) =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, THIN);

export const formatMoney = (n: number) => `${formatNumber(n)}${THIN}DA`;

export const roundHalfUp = (n: number) => Math.floor(n + 0.5);

/** `0555123456` → `05 55 12 34 56` */
export const formatPhoneDz = (p: string) => p.replace(/(\d{2})(?=\d)/g, '$1 ').trim();

const MONTHS: Record<'fr' | 'ar' | 'en', string[]> = {
  fr: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ar: ['جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان', 'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
};

const parts = (d: Date) => {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(d)) o[p.type] = p.value;
  return o;
};

/** `11 oct. 2026` (Africa/Algiers) */
export const formatDate = (d: Date | string, locale: 'fr' | 'ar' | 'en' = 'fr') => {
  const p = parts(new Date(d));
  return `${p.day} ${MONTHS[locale][Number(p.month) - 1]} ${p.year}`;
};

/** `11 oct. 2026 14:05` (Africa/Algiers) */
export const formatDateTime = (d: Date | string, locale: 'fr' | 'ar' | 'en' = 'fr') => {
  const p = parts(new Date(d));
  return `${formatDate(d, locale)} ${p.hour}:${p.minute}`;
};
