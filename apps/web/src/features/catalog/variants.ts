// Variant matrix helpers (CAT-03, DLG "Générer des variantes"): parsing of "Taille : S, M, L", the cartesian
// product of the attribute values, the count of combinations that already exist. Pure functions (unit tested).
import { VARIANTS_MAX } from '@djaber/shared';

export type VariantAttribute = { name: string; values: string[] };
export type VariantCombo = { name: string; attributes: Record<string, string> };

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const key = (s: string) => clean(s).toLowerCase();

/** `"Taille : S, M, L, XL"` → `{ name: 'Taille', values: ['S','M','L','XL'] }`; null when the line is empty or has no value. */
export function parseAttributeLine(line: string): VariantAttribute | null {
  const text = clean(line);
  if (!text) return null;
  const at = text.search(/[:：]/);
  if (at <= 0) return null;
  const name = clean(text.slice(0, at));
  const seen = new Set<string>();
  const values: string[] = [];
  for (const raw of text.slice(at + 1).split(/[,،;]/)) {
    const v = clean(raw);
    if (!v || seen.has(key(v))) continue;
    seen.add(key(v));
    values.push(v);
  }
  return name && values.length ? { name, values } : null;
}

/** `{ name, values }` → `"Taille : S, M, L"` (the inverse of `parseAttributeLine`). */
export const formatAttributeLine = (a: VariantAttribute): string => `${a.name} : ${a.values.join(', ')}`;

/** Attributes with a duplicate name (case-insensitive) are merged into the first one. */
export function normalizeAttributes(attrs: readonly (VariantAttribute | null)[]): VariantAttribute[] {
  const out: VariantAttribute[] = [];
  for (const a of attrs) {
    if (!a) continue;
    const same = out.find((x) => key(x.name) === key(a.name));
    if (same) {
      for (const v of a.values) if (!same.values.some((x) => key(x) === key(v))) same.values.push(v);
    } else out.push({ name: clean(a.name), values: [...a.values] });
  }
  return out;
}

/** Number of combinations without building them. */
export const comboCount = (attrs: readonly VariantAttribute[]): number => (attrs.length ? attrs.reduce((n, a) => n * a.values.length, 1) : 0);

/** Cartesian product, first attribute varying slowest; the name joins the values in attribute order ("Noir · S"). */
export function variantMatrix(attrs: readonly VariantAttribute[], limit = VARIANTS_MAX + 1): VariantCombo[] {
  if (!attrs.length) return [];
  let rows: VariantCombo[] = [{ name: '', attributes: {} }];
  for (const a of attrs) {
    const next: VariantCombo[] = [];
    for (const r of rows) {
      for (const v of a.values) {
        next.push({ name: r.name ? `${r.name} · ${v}` : v, attributes: { ...r.attributes, [a.name]: v } });
        if (next.length >= limit) break;
      }
      if (next.length >= limit) break;
    }
    rows = next;
  }
  return rows;
}

const sameAttributes = (a: Record<string, string>, b: Record<string, string>) => {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  const lower = Object.fromEntries(Object.entries(b).map(([k, v]) => [key(k), key(v)]));
  return ka.every((k) => lower[key(k)] === key(a[k]!));
};

/** Splits the combinations into those that already exist (same attributes, or same name) and the new ones. */
export function splitExisting<T extends { name: string; attributes?: Record<string, string> | null }>(combos: readonly VariantCombo[], existing: readonly T[]) {
  const kept: VariantCombo[] = [];
  const created: VariantCombo[] = [];
  for (const c of combos) {
    const hit = existing.some((e) => key(e.name) === key(c.name) || (e.attributes && Object.keys(e.attributes).length > 0 && sameAttributes(c.attributes, e.attributes)));
    (hit ? kept : created).push(c);
  }
  return { kept, created };
}

/** Would the product exceed `VARIANTS_MAX` (VARIANT_LIMIT)? */
export const exceedsVariantLimit = (existingCount: number, createdCount: number): boolean => existingCount + createdCount > VARIANTS_MAX;

/** Sum of the stock of the active variants = stock of a variant product (CAT-03, read-only on the product). */
export const totalVariantStock = (variants: readonly { stock: number; isActive?: boolean }[]): number => variants.reduce((n, v) => (v.isActive === false ? n : n + v.stock), 0);
