export * from './codes';
export { ERROR_ALIASES } from './aliases';
import fr from './messages.fr.json';
import ar from './messages.ar.json';
import en from './messages.en.json';

export const ERROR_MESSAGES: Record<'fr' | 'ar' | 'en', Record<string, string>> = { fr, ar, en };

/** Replaces `{param}` placeholders. Unknown placeholders are left as-is. */
export const formatMessage = (template: string, params: Record<string, string | number> = {}) =>
  template.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
