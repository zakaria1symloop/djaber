// Email fields of the forms (client, supplier, invitations, reports…): the rule and the formatting of the API
// (`email` + `normalizeEmail` of @djaber/shared, 04 §2), checked inline when the field loses focus. Pure, unit tested.
import { email, normalizeEmail } from '@djaber/shared';

/** Inline error key of an email field (`validation.email`), null when valid — or when empty and `required` is not set. */
export function emailError(raw: string | null | undefined, o: { required?: boolean } = {}): string | null {
  const value = normalizeEmail(raw ?? '');
  if (!value) return o.required ? 'validation.required' : null;
  const r = email.safeParse(value);
  return r.success ? null : (r.error.issues[0]?.message ?? 'validation.email');
}

/** The value sent to the API: normalised, `null` when empty (optional fields). */
export const emailOrNull = (raw: string | null | undefined): string | null => normalizeEmail(raw ?? '') || null;
