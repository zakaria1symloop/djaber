// 03 §37 ORD "Import orders" — column auto-mapping, "SKU×qty;SKU×qty" parsing and per-row validation.
import { autoMapOrders, buildOrderRow, missingOrderColumns, parseItems, resolveWilaya, type ImportCatalog } from './order-import-rows';

const cat = (): ImportCatalog => ({
  skus: new Map([
    ['ROBE-01', { productId: 'p1', variantId: null, name: 'Robe', hasVariants: false, trackStock: true, available: 3, price: 4500 }],
    ['KAB', { productId: 'p2', variantId: null, name: 'Kabyle', hasVariants: true, trackStock: true, available: null, price: 5000 }],
    ['KAB-M', { productId: 'p2', variantId: 'v1', name: 'Kabyle · M', hasVariants: true, trackStock: true, available: 5, price: 5000 }],
  ]),
  wilayas: new Map([
    [16, { id: 16, nameFr: 'Alger', served: true, homePrice: 400 }],
    [19, { id: 19, nameFr: 'Sétif', served: false, homePrice: 600 }],
  ]),
  communes: new Map([[16, new Map([['bab ezzouar', 1601]])]]),
  existingPhones: new Set(['0555123456']),
});
const mapping = autoMapOrders(['Nom', 'Téléphone', 'Wilaya', 'Commune', 'Adresse', 'Articles', 'Note']);
const raw = (over: Record<string, string> = {}) => ({ Nom: 'Amine Benali', Téléphone: '0555 12 34 56', Wilaya: '16', Commune: 'Bab Ezzouar', Adresse: 'Cité 200 logements Bt 4', Articles: 'ROBE-01×2', Note: '', ...over });

describe('order import rows', () => {
  it('auto-maps French headers; required columns', () => {
    expect(mapping).toEqual({ clientName: 'Nom', phone: 'Téléphone', wilaya: 'Wilaya', commune: 'Commune', address: 'Adresse', items: 'Articles', note: 'Note' });
    expect(missingOrderColumns({ clientName: 'Nom' })).toEqual(['phone', 'wilaya', 'address', 'items']);
  });
  it('parses SKU×qty lists', () => {
    expect(parseItems('ROBE-01×2;KAB-M x 1;SAC')).toEqual([
      { sku: 'ROBE-01', quantity: 2 },
      { sku: 'KAB-M', quantity: 1 },
      { sku: 'SAC', quantity: 1 },
    ]);
    expect(parseItems('')).toBeNull();
  });
  it('wilaya by code, "16 - Alger" or name', () => {
    const w = cat().wilayas;
    expect(resolveWilaya('16', w)).toBe(16);
    expect(resolveWilaya('16 - Alger', w)).toBe(16);
    expect(resolveWilaya('alger', w)).toBe(16);
  });
  it('a valid row: existing client, commune resolved, informative total', () => {
    const r = buildOrderRow(2, raw(), mapping, cat(), new Map());
    expect(r).toMatchObject({ ok: true, client: 'existing', values: { phone: '0555123456', wilayaId: 16, communeId: 1601 }, total: 9400 });
  });
  it('errors: phone, unknown SKU, variant required, wilaya not served, stock taken by the rows above', () => {
    const c = cat();
    const taken = new Map<string, number>();
    expect(buildOrderRow(2, raw({ Téléphone: '123' }), mapping, c, taken).errors).toEqual([{ field: 'phone', code: 'VALIDATION_ERROR', params: { rule: 'validation.phone' } }]);
    expect(buildOrderRow(3, raw({ Articles: 'NOPE×1' }), mapping, c, taken).errors).toEqual([{ field: 'items', code: 'NOT_FOUND', params: { sku: 'NOPE' } }]);
    expect(buildOrderRow(4, raw({ Articles: 'KAB×1' }), mapping, c, taken).errors[0]).toMatchObject({ code: 'VARIANT_REQUIRED' });
    expect(buildOrderRow(5, raw({ Wilaya: 'Sétif' }), mapping, c, taken).errors[0]).toMatchObject({ code: 'WILAYA_NOT_SERVED' });
    expect(buildOrderRow(6, raw({ Articles: 'ROBE-01×2' }), mapping, c, taken).ok).toBe(true);
    expect(buildOrderRow(7, raw({ Articles: 'ROBE-01×2' }), mapping, c, taken).errors[0]).toEqual({ field: 'items', code: 'ORDER_INSUFFICIENT_STOCK', params: { product: 'Robe', available: 1 } });
  });
});
