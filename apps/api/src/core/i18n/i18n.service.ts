import { Injectable } from '@nestjs/common';
import { ERROR_MESSAGES, formatMessage, isAppLocale, type AppLocale } from '@djaber/shared';

/** Server-side messages: error catalogue (11) + a few server-rendered strings. UI copy lives in the web app. */
@Injectable()
export class I18nService {
  /** `error.<CODE>` keys resolve from the generated catalogue; unknown keys fall back to the key itself. */
  t(locale: string, key: string, params: Record<string, string | number> = {}): string {
    const l: AppLocale = isAppLocale(locale) ? locale : 'fr';
    if (key.startsWith('error.')) {
      const code = key.slice('error.'.length);
      const template = ERROR_MESSAGES[l][code] ?? ERROR_MESSAGES.fr[code] ?? code;
      return formatMessage(template, params);
    }
    return formatMessage(key, params);
  }

  /** Picks the value of a localized JSON column `{ fr, ar, en }`. */
  pick(value: unknown, locale: string): string {
    if (value && typeof value === 'object') {
      const o = value as Record<string, string>;
      return o[locale] ?? o.fr ?? Object.values(o)[0] ?? '';
    }
    return typeof value === 'string' ? value : '';
  }
}

/** `Accept-Language` / `?lang` → fr | ar | en (default fr). */
export const resolveLocale = (header: unknown, query: unknown): AppLocale => {
  if (isAppLocale(query)) return query;
  if (typeof header === 'string') {
    for (const part of header.split(',')) {
      const tag = part.trim().slice(0, 2).toLowerCase();
      if (isAppLocale(tag)) return tag;
    }
  }
  return 'fr';
};
