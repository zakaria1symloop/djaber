// 03 §37 ORD "Import orders" (D69) — pure part of the order import: column auto-mapping and per-row validation against
// the catalogue / geography loaded by the service. Columns `clientName, phone, wilaya, commune?, address, items
// ("SKU×qty;SKU×qty"), note?`. Each error = an error-catalogue code + the field.
import { fullName, isPhoneDz, normalizePhoneDz, ORDER_IMPORT_FIELDS, ORDER_IMPORT_REQUIRED_FIELDS, type OrderImportField, type OrderImportPreviewRow, type OrderImportRowError } from '@djaber/shared';
import { fold, WILAYA_ALIASES } from '../ai/tools/wilaya-aliases';

export type OrderImportMapping = Partial<Record<OrderImportField, string>>;
const ALIASES: Record<OrderImportField, string[]> = {
  clientName: ['clientname', 'client', 'nom', 'name', 'nom client', 'nom complet', 'customer', 'الاسم', 'الزبون'],
  phone: ['phone', 'telephone', 'téléphone', 'tel', 'mobile', 'numero', 'numéro', 'الهاتف'],
  wilaya: ['wilaya', 'willaya', 'state', 'الولاية'],
  commune: ['commune', 'city', 'ville', 'البلدية'],
  address: ['address', 'adresse', 'العنوان'],
  items: ['items', 'articles', 'produits', 'products', 'sku', 'المنتجات'],
  note: ['note', 'notes', 'remarque', 'comment', 'commentaire', 'ملاحظة'],
};

export const autoMapOrders = (headers: string[]): OrderImportMapping => {
  const m: OrderImportMapping = {};
  const used = new Set<string>();
  for (const f of ORDER_IMPORT_FIELDS) {
    const h = headers.find((x) => !used.has(x) && ALIASES[f].includes(fold(x).replace(/[_-]+/g, ' ').trim()));
    if (h) {
      m[f] = h;
      used.add(h);
    }
  }
  return m;
};
export const missingOrderColumns = (m: OrderImportMapping) => ORDER_IMPORT_REQUIRED_FIELDS.filter((f) => !m[f]);

/** "SKU×2;SKU2×1" (also `x`, `*`, `,` between lines; a bare SKU = 1). */
export const parseItems = (raw: string): { sku: string; quantity: number }[] | null => {
  const parts = raw
    .split(/[;|\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  const out: { sku: string; quantity: number }[] = [];
  for (const p of parts) {
    const m = /^(.+?)\s*(?:[×xX*]\s*(\d+))?$/.exec(p);
    if (!m) return null;
    const quantity = m[2] ? Number(m[2]) : 1;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10_000) return null;
    out.push({ sku: m[1]!.trim(), quantity });
  }
  return out;
};

export type ImportCatalog = {
  /** SKU → product (no variant) or variant of a product */
  skus: Map<string, { productId: string; variantId: string | null; name: string; hasVariants: boolean; trackStock: boolean; available: number | null; price: number }>;
  wilayas: Map<number, { id: number; nameFr: string; served: boolean; homePrice: number }>;
  communes: Map<number, Map<string, number>>;
  existingPhones: Set<string>;
};

export const resolveWilaya = (raw: string, wilayas: ImportCatalog['wilayas']): number | null => {
  const t = raw.trim();
  const n = /^\d{1,2}$/.test(t) ? Number(t) : /^(\d{1,2})\s*[-–.]/.exec(t) ? Number(/^(\d{1,2})/.exec(t)![1]) : null;
  if (n && wilayas.has(n)) return n;
  const f = fold(t.replace(/^\d{1,2}\s*[-–.]\s*/, ''));
  if (WILAYA_ALIASES[f]) return WILAYA_ALIASES[f]!;
  for (const w of wilayas.values()) if (fold(w.nameFr) === f) return w.id;
  return null;
};

/** One row of the file → values + errors. Stock is checked per row against the stock left by the rows above it. */
export function buildOrderRow(rowNo: number, raw: Record<string, string>, mapping: OrderImportMapping, cat: ImportCatalog, taken: Map<string, number>): OrderImportPreviewRow {
  const get = (f: OrderImportField) => (mapping[f] ? String(raw[mapping[f]!] ?? '').trim() : '');
  const errors: OrderImportRowError[] = [];
  const name = get('clientName');
  if (!fullName.safeParse(name).success) errors.push({ field: 'clientName', code: 'VALIDATION_ERROR', params: { rule: 'validation.name' } });
  const phone = normalizePhoneDz(get('phone'));
  if (!isPhoneDz(phone)) errors.push({ field: 'phone', code: 'VALIDATION_ERROR', params: { rule: 'validation.phone' } });
  const wilayaId = resolveWilaya(get('wilaya'), cat.wilayas);
  const wilaya = wilayaId ? cat.wilayas.get(wilayaId)! : null;
  if (!wilaya) errors.push({ field: 'wilaya', code: 'VALIDATION_ERROR', params: { rule: 'validation.wilaya' } });
  else if (!wilaya.served) errors.push({ field: 'wilaya', code: 'WILAYA_NOT_SERVED' });
  const communeRaw = get('commune');
  const communeId = wilayaId && communeRaw ? (cat.communes.get(wilayaId)?.get(fold(communeRaw)) ?? null) : null;
  if (communeRaw.length > 100) errors.push({ field: 'commune', code: 'VALIDATION_ERROR', params: { rule: 'validation.commune' } });
  const address = get('address');
  if (address.length < 10) errors.push({ field: 'address', code: 'VALIDATION_ERROR', params: { rule: 'validation.address' } });
  const note = get('note') || null;
  const parsed = parseItems(get('items'));
  const items: OrderImportPreviewRow['values']['items'] = [];
  let subtotal = 0;
  if (!parsed) errors.push({ field: 'items', code: 'VALIDATION_ERROR', params: { rule: 'validation.quantity' } });
  else {
    const need = new Map<string, number>();
    for (const it of parsed) {
      const hit = cat.skus.get(it.sku) ?? cat.skus.get(it.sku.toUpperCase());
      if (!hit) {
        errors.push({ field: 'items', code: 'NOT_FOUND', params: { sku: it.sku } });
        items.push({ sku: it.sku, quantity: it.quantity, productId: null, variantId: null, name: null, unitPrice: null });
        continue;
      }
      if (hit.hasVariants && !hit.variantId) errors.push({ field: 'items', code: 'VARIANT_REQUIRED', params: { sku: it.sku } });
      items.push({ sku: it.sku, quantity: it.quantity, productId: hit.productId, variantId: hit.variantId, name: hit.name, unitPrice: hit.price });
      subtotal += hit.price * it.quantity;
      if (hit.trackStock && hit.available !== null) {
        const k = `${hit.productId}|${hit.variantId ?? ''}`;
        need.set(k, (need.get(k) ?? 0) + it.quantity);
        const left = hit.available - (taken.get(k) ?? 0);
        if ((need.get(k) ?? 0) > left) errors.push({ field: 'items', code: 'ORDER_INSUFFICIENT_STOCK', params: { product: hit.name, available: Math.max(0, left) } });
      }
    }
    // a valid row reserves its quantities for the rows below it (the commit takes them in file order)
    if (!errors.length) for (const [k, q] of need) taken.set(k, (taken.get(k) ?? 0) + q);
  }
  return {
    row: rowNo,
    ok: errors.length === 0,
    values: { clientName: name || null, phone: isPhoneDz(phone) ? phone : get('phone') || null, wilayaId, wilaya: wilaya?.nameFr ?? (get('wilaya') || null), commune: communeRaw || null, communeId, address: address || null, note, items },
    total: wilaya && parsed ? subtotal + wilaya.homePrice : null,
    client: isPhoneDz(phone) ? (cat.existingPhones.has(phone) ? 'existing' : 'new') : null,
    errors,
  };
}
