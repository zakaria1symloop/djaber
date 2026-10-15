import { describe, expect, it } from 'vitest';
import { emailError, emailOrNull } from './email';
import { formatPhoneOnBlur, phoneError } from './phone';

describe('email fields (same rule as the API)', () => {
  it('accepts a trimmed / upper-case address, refuses a malformed one with validation.email', () => {
    expect(emailError('  Amina@Boutique.DZ ')).toBeNull();
    expect(emailError('amina@boutique')).toBe('validation.email');
    expect(emailError('amina boutique.dz')).toBe('validation.email');
  });
  it('empty is fine unless required', () => {
    expect(emailError('')).toBeNull();
    expect(emailError('   ')).toBeNull();
    expect(emailError(null)).toBeNull();
    expect(emailError('', { required: true })).toBe('validation.required');
  });
  it('sends the normalised value or null', () => {
    expect(emailOrNull('  Amina@Boutique.DZ ')).toBe('amina@boutique.dz');
    expect(emailOrNull('  ')).toBeNull();
  });
});

describe('phone fields: formatting on blur', () => {
  it('a valid DZ number takes the national form, anything else is only trimmed', () => {
    expect(formatPhoneOnBlur(' +213 555 12 34 56 ')).toBe('0555123456');
    expect(formatPhoneOnBlur('021 23 45 67')).toBe('021234567');
    expect(formatPhoneOnBlur(' 0555 12 ')).toBe('0555 12');
    expect(formatPhoneOnBlur('')).toBe('');
  });
  it('inline error only for a typed, invalid number', () => {
    expect(phoneError('0555 12')).toBe('validation.phone');
    expect(phoneError('0555123456')).toBeNull();
    expect(phoneError('')).toBeNull();
  });
});
