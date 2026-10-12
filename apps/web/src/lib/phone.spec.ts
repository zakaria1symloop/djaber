import { describe, expect, it } from 'vitest';
import { looksLikePhone, phonePreview, phonePreviewLine, searchTerm } from './phone';

const t = (key: string, params?: Record<string, string>) => (params ? `${key}:${JSON.stringify(params)}` : key);

describe('phonePreview (04 §2 normalisation, ORD-02 preview line)', () => {
  it('normalises +213 / 00213 / spaces to the national form', () => {
    expect(phonePreview('+213 555 12 34 56')).toEqual({ normalized: '0555123456', valid: true, kind: 'mobile', display: '0555 12 34 56' });
    expect(phonePreview('00213 661-44-10-92')?.normalized).toBe('0661441092');
    expect(phonePreview('0555.12.34.56')?.normalized).toBe('0555123456');
  });
  it('recognises landlines (9 digits) and rejects the rest', () => {
    expect(phonePreview('021 23 45 67')).toMatchObject({ normalized: '021234567', valid: true, kind: 'landline', display: '021 23 45 67' });
    expect(phonePreview('0855123456')).toMatchObject({ valid: false, kind: null });
    expect(phonePreview('0555 12')).toMatchObject({ valid: false });
  });
  it('is null for an empty field', () => {
    expect(phonePreview('')).toBeNull();
    expect(phonePreview('   ')).toBeNull();
    expect(phonePreview(null)).toBeNull();
  });
});

describe('phonePreviewLine', () => {
  it('mobile, landline, invalid, empty', () => {
    expect(phonePreviewLine(t, '+213555123456')).toEqual({ text: 'phone.preview.mobile:{"phone":"0555123456"}', tone: 'muted' });
    expect(phonePreviewLine(t, '021234567')).toEqual({ text: 'phone.preview.landline:{"phone":"021234567"}', tone: 'muted' });
    expect(phonePreviewLine(t, '12')).toEqual({ text: 'phone.preview.invalid', tone: 'danger' });
    expect(phonePreviewLine(t, '')).toBeNull();
  });
});

describe('client search term', () => {
  it('sends phone fragments normalised, names as typed', () => {
    expect(looksLikePhone('0555 12')).toBe(true);
    expect(looksLikePhone('+213 555')).toBe(true);
    expect(looksLikePhone('Amina')).toBe(false);
    expect(searchTerm('0555 12')).toBe('055512');
    expect(searchTerm('+213 555 12')).toBe('055512');
    expect(searchTerm('  Amina B ')).toBe('Amina B');
  });
});
