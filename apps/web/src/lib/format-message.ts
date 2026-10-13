// ICU formatting of a flat catalogue key — shared by the client hook `useT()` (lib/i18n.tsx) and server code
// (public pages metadata, lib/server-i18n.ts). No React, no 'use client'.
import { IntlMessageFormat } from 'intl-messageformat';

export type Flat = Record<string, string>;
export type Params = Record<string, string | number | Date | null | undefined>;
export type TFunction = ((key: string, params?: Params) => string) & { has: (key: string) => boolean };

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

/** A `t()` bound to one locale + catalogue (same contract as `useT()`). */
export const makeT = (locale: string, messages: Flat): TFunction =>
  Object.assign((key: string, params?: Params) => formatMessage(locale, messages, key, params), { has: (key: string) => messages[key] !== undefined });
