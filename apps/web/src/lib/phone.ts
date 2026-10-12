// Phone normalisation preview of the forms (ORD-02 "Normalisé : 0555123456 · mobile DZ valide", CLI-01): the same
// rule as the API (`normalizePhoneDz` + `isPhoneDz` of @djaber/shared, 04 §2). Pure, unit tested.
import { formatPhoneDz, isPhoneDz, normalizePhoneDz } from '@djaber/shared';

export type PhonePreview = { normalized: string; valid: boolean; kind: 'mobile' | 'landline' | null; display: string };

/** `"+213 555 12 34 56"` → `{ normalized: '0555123456', valid: true, kind: 'mobile', display: '0555 12 34 56' }`; empty → null. */
export function phonePreview(raw: string | null | undefined): PhonePreview | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;
  const normalized = normalizePhoneDz(trimmed);
  const valid = isPhoneDz(normalized);
  const kind = !valid ? null : /^0[5-7]/.test(normalized) ? 'mobile' : 'landline';
  return { normalized, valid, kind, display: valid ? formatPhoneDz(normalized) : trimmed };
}

/** Digits typed in a client search box look like a phone fragment ("0555 12") — the search is sent normalised. */
export const looksLikePhone = (q: string): boolean => /^[+\d][\d\s.\-()]{2,}$/.test(q.trim());
export const searchTerm = (q: string): string => (looksLikePhone(q) ? normalizePhoneDz(q.trim()) : q.trim());

/** Preview line of `<PhoneInput>`: "Normalisé : 0555123456 · mobile DZ valide" / invalid in red / nothing when empty. */
export function phonePreviewLine(t: (key: string, params?: Record<string, string>) => string, raw: string | null | undefined): { text: string; tone: 'muted' | 'danger' } | null {
  const p = phonePreview(raw);
  if (!p) return null;
  if (!p.valid) return { text: t('phone.preview.invalid'), tone: 'danger' };
  return { text: t(p.kind === 'mobile' ? 'phone.preview.mobile' : 'phone.preview.landline', { phone: p.normalized }), tone: 'muted' };
}
