/**
 * The error CATALOG: every code the API can answer, with its HTTP status and
 * its text in the three languages of the product (en / fr / ar).
 *
 * Codes are SCREAMING_SNAKE_CASE and stable — clients switch on them, so never
 * rename one; add a new one instead. Messages may use `{param}` placeholders.
 *
 * The catalog is split per module so teams can extend it without conflicts:
 * add your codes to the module file, they are merged here.
 */
import { core } from './catalog.core';
import { auth } from './catalog.auth';
import { pages } from './catalog.pages';
import { inbox } from './catalog.inbox';
import { stock } from './catalog.stock';
import { commerce } from './catalog.commerce';
import { ops } from './catalog.ops';
import { analytics } from './catalog.analytics';
import { admin } from './catalog.admin';

export interface ErrorDef {
  /** HTTP status this code answers with. */
  status: number;
  en: string;
  fr: string;
  ar: string;
}

export type ErrorCatalog = Record<string, ErrorDef>;

export const CATALOG = {
  ...core,
  ...auth,
  ...pages,
  ...inbox,
  ...stock,
  ...commerce,
  ...ops,
  ...analytics,
  ...admin,
} as const satisfies ErrorCatalog;

export type ErrorCode = keyof typeof CATALOG;
