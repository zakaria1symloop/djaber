// Shared client-side validation helpers used across stock forms (clients,
// suppliers, products, categories, orders).
//
// Keep the rules permissive enough for Algerian merchant use-cases:
//   - Phone: digits, spaces, dashes, parentheses, optional leading "+".
//             8-15 total digits. Algerian mobile = 10 digits starting "0".
//   - Email: a single "@" + at least one "." in the domain. We rely on the
//             browser's own type="email" first, but also enforce on submit.
//   - Names (product / category / supplier / client):
//             at least one alphanumeric character (Latin OR Arabic OR digit).
//             Pure-special-char strings ("@@@###", "@&é\"(") are rejected.

const PHONE_RE = /^\+?[0-9\s\-().]{8,20}$/;
const HAS_DIGIT_COUNT_RE = /[0-9]/g;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Allow Latin letters, Arabic letters (U+0600-U+06FF), and digits
const ALNUM_RE = /[A-Za-z0-9؀-ۿ]/;

export function isValidPhone(raw: string): boolean {
  if (!raw) return false;
  const v = raw.trim();
  if (!PHONE_RE.test(v)) return false;
  const digits = v.match(HAS_DIGIT_COUNT_RE)?.length || 0;
  return digits >= 8 && digits <= 15;
}

export function isValidEmail(raw: string): boolean {
  if (!raw) return false;
  return EMAIL_RE.test(raw.trim());
}

export function hasAlphanumeric(raw: string): boolean {
  if (!raw) return false;
  return ALNUM_RE.test(raw);
}

export function isValidName(raw: string, minLen = 2): boolean {
  if (!raw) return false;
  const v = raw.trim();
  if (v.length < minLen) return false;
  return hasAlphanumeric(v);
}

// Return the first error string for a given field, or null if it's valid.
// Used in form submit handlers to short-circuit on the first issue and show
// it inline on the modal (not at page level).

export function validateRequired(value: string, label: string): string | null {
  if (!value || !value.trim()) return `${label} is required`;
  return null;
}

export function validateName(value: string, label: string): string | null {
  const r = validateRequired(value, label);
  if (r) return r;
  if (!hasAlphanumeric(value)) {
    return `${label} must contain at least one letter or number`;
  }
  return null;
}

export function validateEmailOptional(value: string): string | null {
  if (!value || !value.trim()) return null;
  if (!isValidEmail(value)) return 'Email format is invalid (e.g. name@example.com)';
  return null;
}

export function validatePhoneOptional(value: string): string | null {
  if (!value || !value.trim()) return null;
  if (!isValidPhone(value)) return 'Phone must be 8-15 digits (e.g. 0555 12 34 56)';
  return null;
}

export function validatePhoneRequired(value: string): string | null {
  if (!value || !value.trim()) return 'Phone is required';
  if (!isValidPhone(value)) return 'Phone must be 8-15 digits (e.g. 0555 12 34 56)';
  return null;
}
