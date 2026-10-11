'use client';
// `useT()` — flat keys of the shared catalogue (06-i18n-copy-deck: `nav.home`, `error.NOT_FOUND`, …), ICU formatting.
import { IntlMessageFormat } from 'intl-messageformat';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

type Flat = Record<string, string>;
type Params = Record<string, string | number | Date | null | undefined>;
export type TFunction = ((key: string, params?: Params) => string) & { has: (key: string) => boolean };

const Ctx = createContext<{ locale: string; messages: Flat }>({ locale: 'fr', messages: {} });

export function MessagesProvider({ locale, messages, children }: { locale: string; messages: Flat; children: ReactNode }) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const cache = new Map<string, IntlMessageFormat>();

export const formatMessage = (locale: string, messages: Flat, key: string, params?: Params): string => {
  const template = messages[key];
  if (template === undefined) return key; // visible in the UI and caught by `pnpm i18n:check`
  if (!params && !template.includes('{')) return template;
  const id = `${locale}:${key}`;
  let fmt = cache.get(id);
  if (!fmt) {
    try {
      fmt = new IntlMessageFormat(template, locale, undefined, { ignoreTag: true });
    } catch {
      return template;
    }
    cache.set(id, fmt);
  }
  try {
    return String(fmt.format(params as Record<string, string | number>));
  } catch {
    return template;
  }
};

export function useT(): TFunction {
  const { locale, messages } = useContext(Ctx);
  const t = useCallback((key: string, params?: Params) => formatMessage(locale, messages, key, params), [locale, messages]);
  return useMemo(() => Object.assign(t, { has: (key: string) => messages[key] !== undefined }), [t, messages]);
}

export const useLocaleCode = () => useContext(Ctx).locale;
