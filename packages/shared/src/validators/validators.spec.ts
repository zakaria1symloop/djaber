// 04-business-rules §2 — validators shared by API, web, mobile and AI tools.
import { describe, expect, it } from 'vitest';
import { formatMoney, formatPhoneDz, roundHalfUp } from '../format';
import { PageQuery } from '../schemas/common';
import { addressHome, email, fullName, isPhoneDz, lineQuantity, normalizePhoneDz, password, phoneDz, sellingPrice, wilayaCode } from './index';

const ok = (s: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) => s.safeParse(v).success;

describe('phone DZ', () => {
  it.each([
    ['0555123456', '0555123456'],
    ['+213 555 12 34 56', '0555123456'],
    ['00213555123456', '0555123456'],
    ['213555123456', '0555123456'],
    ['05.55.12.34.56', '0555123456'],
    ['021 23 45 67', '021234567'],
  ])('normalises %s → %s', (raw, expected) => {
    expect(normalizePhoneDz(raw)).toBe(expected);
    expect(phoneDz.parse(raw)).toBe(expected);
  });
  it.each(['0855123456', '055512345', '05551234567', 'abc', '', '0155123456'])('rejects %s', (raw) => {
    expect(isPhoneDz(normalizePhoneDz(raw))).toBe(false);
    const r = phoneDz.safeParse(raw);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]!.message).toBe('validation.phone');
  });
});

describe('name, address, email, password', () => {
  it('full name: 3–80 chars, at least 2 letters, Arabic accepted', () => {
    expect(ok(fullName, 'Amina B.')).toBe(true);
    expect(ok(fullName, 'أمينة بن علي')).toBe(true);
    expect(ok(fullName, 'Al')).toBe(false);
    expect(ok(fullName, '123 4')).toBe(false);
    expect(ok(fullName, 'x'.repeat(81))).toBe(false);
    expect(ok(fullName, 'Amina <script>')).toBe(false);
  });
  it('home address needs 10 characters', () => {
    expect(ok(addressHome, 'Cité 5 juillet, Bt 12')).toBe(true);
    expect(ok(addressHome, 'Rue 1')).toBe(false);
  });
  it('email is trimmed and lower-cased', () => {
    expect(email.parse('  Zak@Boutique.DZ ')).toBe('zak@boutique.dz');
    expect(ok(email, 'zak@boutique')).toBe(false);
  });
  it('password: 8 chars min, a letter and a digit', () => {
    expect(ok(password, 'abcdefg1')).toBe(true);
    expect(ok(password, 'abcdefgh')).toBe(false);
    expect(ok(password, '12345678')).toBe(false);
    expect(ok(password, 'abc1')).toBe(false);
  });
});

describe('numbers', () => {
  it('wilaya 1–69, price > 0 integer DZD, quantity ≥ 1', () => {
    expect(ok(wilayaCode, 16)).toBe(true);
    expect(ok(wilayaCode, 59)).toBe(true);
    expect(ok(wilayaCode, 69)).toBe(true);
    expect(ok(wilayaCode, 70)).toBe(false);
    expect(ok(wilayaCode, 0)).toBe(false);
    expect(ok(sellingPrice, 4500)).toBe(true);
    expect(ok(sellingPrice, 0)).toBe(false);
    expect(ok(sellingPrice, 45.5)).toBe(false);
    expect(ok(lineQuantity, 1)).toBe(true);
    expect(ok(lineQuantity, 0)).toBe(false);
  });
  it('page query: 25 / 50 / 100, default 25', () => {
    expect(PageQuery.parse({})).toMatchObject({ page: 1, pageSize: 25 });
    expect(PageQuery.parse({ page: '3', pageSize: '50' })).toMatchObject({ page: 3, pageSize: 50 });
    expect(PageQuery.safeParse({ pageSize: 20 }).success).toBe(false);
  });
});

describe('formatting', () => {
  it('money uses thin spaces and DA, half-up rounding', () => {
    expect(formatMoney(1240000).replace(/\s/g, ' ')).toBe('1 240 000 DA');
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(2.4)).toBe(2);
    expect(formatPhoneDz('0555123456')).toBe('0555 12 34 56');
  });
});
