// Message catalogue shared by web, API (error messages, notification titles, exports) and mobile (copied at build).
// deck.*  = keys extracted from docs/implementation/06-i18n-copy-deck.md (tools/gen-copy.mjs)
// app.*   = page-specific keys added milestone after milestone (FR copied verbatim from the Figma frames)
// admin-core = keys of the platform admin shell + core screens (M10 web-a; separate file so parallel teams edit different files)
// error.* = generated from docs/specs/11-error-catalogue.md (tools/gen-errors.mjs)
import errAr from '../errors/messages.ar.json';
import errEn from '../errors/messages.en.json';
import errFr from '../errors/messages.fr.json';
import appAr from './messages/app.ar.json';
import appEn from './messages/app.en.json';
import appFr from './messages/app.fr.json';
import admAr from './messages/admin-core.ar.json';
import admEn from './messages/admin-core.en.json';
import admFr from './messages/admin-core.fr.json';
import deckAr from './messages/deck.ar.json';
import deckEn from './messages/deck.en.json';
import deckFr from './messages/deck.fr.json';
import type { AppLocale } from './index';

type Flat = Record<string, string>;
const withErrors = (base: Flat, app: Flat, errors: Flat, admin: Flat = {}): Flat => {
  const out: Flat = { ...base, ...app, ...admin };
  for (const [code, text] of Object.entries(errors)) out[`error.${code}`] = text;
  return out;
};

export const MESSAGES: Record<AppLocale, Flat> = {
  fr: withErrors(deckFr, appFr, errFr, admFr),
  ar: withErrors(deckAr, appAr, errAr, admAr),
  en: withErrors(deckEn, appEn, errEn, admEn),
};

/** Flat `key -> ICU message` map of a locale. */
export const getMessages = (locale: AppLocale): Flat => MESSAGES[locale] ?? MESSAGES.fr;
