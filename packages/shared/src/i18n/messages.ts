// Message catalogue shared by web, API (error messages, notification titles, exports) and mobile (copied at build).
// deck.*  = keys extracted from docs/implementation/06-i18n-copy-deck.md (tools/gen-copy.mjs)
// app.*   = page-specific keys added milestone after milestone (FR copied verbatim from the Figma frames)
// error.* = generated from docs/specs/11-error-catalogue.md (tools/gen-errors.mjs)
import errAr from '../errors/messages.ar.json';
import errEn from '../errors/messages.en.json';
import errFr from '../errors/messages.fr.json';
import appAr from './messages/app.ar.json';
import appEn from './messages/app.en.json';
import appFr from './messages/app.fr.json';
import deckAr from './messages/deck.ar.json';
import deckEn from './messages/deck.en.json';
import deckFr from './messages/deck.fr.json';
import type { AppLocale } from './index';

type Flat = Record<string, string>;
const withErrors = (base: Flat, app: Flat, errors: Flat): Flat => {
  const out: Flat = { ...base, ...app };
  for (const [code, text] of Object.entries(errors)) out[`error.${code}`] = text;
  return out;
};

export const MESSAGES: Record<AppLocale, Flat> = {
  fr: withErrors(deckFr, appFr, errFr),
  ar: withErrors(deckAr, appAr, errAr),
  en: withErrors(deckEn, appEn, errEn),
};

/** Flat `key -> ICU message` map of a locale. */
export const getMessages = (locale: AppLocale): Flat => MESSAGES[locale] ?? MESSAGES.fr;
