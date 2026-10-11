// Integer DZD helpers for forms (CLAUDE.md rule 11: integer DZD, Latin digits, `12 500 DA`).
import { formatNumber } from '@djaber/shared';

const ARABIC_ZERO = 0x0660;

/** `"12 500 DA"`, `"12500"`, Arabic-Indic digits → 12500 · `""` → null · anything else (decimals, signs, text) → NaN. */
export function parseMoney(input: string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const latin = Array.from(input, (ch) => {
    const code = ch.charCodeAt(0);
    return code >= ARABIC_ZERO && code <= ARABIC_ZERO + 9 ? String(code - ARABIC_ZERO) : ch;
  }).join('');
  // `\s` covers the thin, narrow and no-break spaces used as thousands separators
  const cleaned = latin.replace(/\s/g, '').replace(/(DA|دج)$/i, '');
  if (cleaned === '') return null;
  if (!/^\d{1,12}$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}

/** Digits of a stored amount for a `MoneyInput` (`null` → `''`). */
export const moneyDigits = (n: number | null | undefined): string => (n === null || n === undefined ? '' : String(Math.trunc(n)));

/** Number sent to the API from the digits of an input (`''` → null). */
export const digitsToInt = (digits: string): number | null => (digits === '' ? null : Number(digits));

/** Margin in percent of the selling price, half-up, null when it cannot be computed (04 §2: (price − cost) / price). */
export function marginPct(price: number | null, cost: number | null): number | null {
  if (price === null || cost === null || price <= 0) return null;
  const x = ((price - cost) * 100) / price;
  return x >= 0 ? Math.floor(x + 0.5) : -Math.floor(-x + 0.5);
}

/** `1 240 000` → `1,24 M` (fr / ar) or `1.24 M` (en) for KPI tiles; under one million the plain grouped number. */
export function compactAmount(n: number, locale: string): string {
  if (Math.abs(n) < 1_000_000) return formatNumber(n);
  const v = Math.round(n / 10_000) / 100;
  const s = v.toFixed(2).replace(/0$/, '');
  return `${locale === 'en' ? s : s.replace('.', ',')} M`;
}
