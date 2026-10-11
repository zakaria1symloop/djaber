export const LOCALES = ['fr', 'ar', 'en'] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'fr';
export const isRtl = (l: string) => l === 'ar';
export const isAppLocale = (l: unknown): l is AppLocale =>
  typeof l === 'string' && (LOCALES as readonly string[]).includes(l);
