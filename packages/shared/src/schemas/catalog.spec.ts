// 04 §2 / 03 §8 — catalogue input schemas shared by the API and the web forms.
import { describe, expect, it } from 'vitest';
import {
  BulkPriceSchema,
  computeBulkPrice,
  CreateCategorySchema,
  CreateProductSchema,
  CreateVariantSchema,
  GenerateVariantsSchema,
  ImportMappingSchema,
  StockAdjustmentSchema,
  UpdateProductSchema,
} from './catalog';

const fields = (schema: { safeParse: (v: unknown) => any }, value: unknown): Record<string, string> => {
  const r = schema.safeParse(value);
  if (r.success) return {};
  return Object.fromEntries(r.error.issues.map((i: any) => [i.path.join('.') || '_', i.message]));
};

describe('CreateProductSchema (CAT-01)', () => {
  it('selling price is an integer > 0; cost an integer ≥ 0', () => {
    expect(fields(CreateProductSchema, { name: 'A', price: 0, stock: 1 })).toEqual({ price: 'validation.price' });
    expect(fields(CreateProductSchema, { name: 'A', price: 10.5, stock: 1 })).toEqual({ price: 'validation.price' });
    expect(fields(CreateProductSchema, { name: 'A', price: '100', stock: 1 })).toEqual({ price: 'validation.price' });
    expect(fields(CreateProductSchema, { name: 'A', stock: 1 })).toEqual({ price: 'validation.required' });
    expect(fields(CreateProductSchema, { name: 'A', price: 100, costPrice: -1, stock: 1 })).toEqual({ costPrice: 'validation.price' });
    expect(fields(CreateProductSchema, { name: 'A', price: 100, costPrice: 0, stock: 0 })).toEqual({});
  });

  it('stock is required for a tracked product without variants only', () => {
    expect(fields(CreateProductSchema, { name: 'A', price: 100 })).toEqual({ stock: 'validation.required' });
    expect(fields(CreateProductSchema, { name: 'Service', price: 100, trackStock: false })).toEqual({});
    expect(fields(CreateProductSchema, { name: 'A', price: 100, variants: [{ name: 'S', price: 100 }] })).toEqual({});
    expect(fields(CreateProductSchema, { name: 'A', price: 100, trackStock: false, variants: [{ name: 'S', price: 100 }] })).toEqual({ variants: 'validation.invalid' });
    expect(fields(CreateProductSchema, { name: 'A', price: 100, variants: [{ name: 'S', price: 100 }, { name: 's', price: 100 }] })).toEqual({ 'variants.1.name': 'validation.invalid' });
  });

  it('text limits, empty strings as "no value", unknown keys rejected', () => {
    expect(fields(CreateProductSchema, { name: '  ', price: 1, stock: 0 })).toEqual({ name: 'validation.required' });
    expect(fields(CreateProductSchema, { price: 1, stock: 0 })).toEqual({ name: 'validation.required' });
    expect(fields(CreateProductSchema, { name: 'x'.repeat(256), price: 1, stock: 0 })).toEqual({ name: 'validation.length' });
    expect(fields(CreateProductSchema, { name: 'A', price: 1, stock: 0, description: 'x'.repeat(5001) })).toEqual({ description: 'validation.length' });
    expect(fields(CreateProductSchema, { name: 'A', price: 1, stock: 0, workspaceId: 'x' })).toHaveProperty('_');
    const parsed = CreateProductSchema.parse({ name: ' Tapis ', price: 1, stock: 0, sku: '', categoryId: '', description: '' });
    expect(parsed).toMatchObject({ name: 'Tapis', sku: null, categoryId: null, description: null });
  });
});

describe('UpdateProductSchema', () => {
  it('needs the version and never accepts stock', () => {
    expect(fields(UpdateProductSchema, { name: 'A' })).toEqual({ version: 'validation.required' });
    expect(fields(UpdateProductSchema, { version: 3, price: 0 })).toEqual({ price: 'validation.price' });
    expect(fields(UpdateProductSchema, { version: 3, stock: 4 })).toHaveProperty('_');
    expect(fields(UpdateProductSchema, { version: 3, costPrice: null, isActive: false })).toEqual({});
  });
});

describe('variants, categories, stock, import mapping', () => {
  it('variant: name and price required; generator bounds', () => {
    expect(fields(CreateVariantSchema, { price: 100 })).toEqual({ name: 'validation.required' });
    expect(fields(CreateVariantSchema, { name: 'S', price: 0 })).toEqual({ price: 'validation.price' });
    expect(fields(CreateVariantSchema, { name: 'S', price: 100, stock: -1 })).toEqual({ stock: 'validation.quantity' });
    expect(fields(GenerateVariantsSchema, { attributes: [], defaultPrice: 100, defaultStock: 0 })).toEqual({ attributes: 'validation.required' });
    expect(fields(GenerateVariantsSchema, { attributes: [{ name: 'Taille', values: ['S', 'M'] }], defaultPrice: 100, defaultStock: 0 })).toEqual({});
  });

  it('category colour is a hex value; stock adjustment needs a reason from the list', () => {
    expect(fields(CreateCategorySchema, { name: 'A', color: '#12345' })).toEqual({ color: 'validation.invalid' });
    expect(fields(CreateCategorySchema, { name: 'A', color: '#A1b2C3', parentId: '' })).toEqual({});
    const id = '018f0000-0000-7000-8000-000000000000';
    expect(fields(StockAdjustmentSchema, { productId: id, type: 'in', quantity: 1 })).toEqual({ reason: 'validation.required' });
    expect(fields(StockAdjustmentSchema, { productId: id, type: 'in', quantity: 1, reason: 'sale' })).toEqual({ reason: 'validation.required' });
    expect(fields(StockAdjustmentSchema, { productId: id, type: 'move', quantity: 1, reason: 'loss' })).toEqual({ type: 'validation.invalid' });
    expect(fields(StockAdjustmentSchema, { productId: id, type: 'set', quantity: 0, reason: 'inventory', note: 'x'.repeat(256) })).toEqual({ note: 'validation.length' });
    expect(fields(StockAdjustmentSchema, { productId: id, variantId: '', type: 'out', quantity: 2, reason: 'breakage', force: true })).toEqual({});
  });

  it('import mapping only knows the import fields', () => {
    const jobId = '018f0000-0000-7000-8000-000000000000';
    expect(fields(ImportMappingSchema, { jobId, mapping: { name: 'Nom', price: 'Prix', stock: null } })).toEqual({});
    expect(Object.keys(fields(ImportMappingSchema, { jobId, mapping: { title: 'Nom' } }))).toEqual(['mapping.title']);
  });
});

describe('bulk price (06 §8.6)', () => {
  it('computes the new price in integer DA', () => {
    expect(computeBulkPrice(1990, { op: 'increase', value: 10, unit: 'percent' })).toBe(2189);
    expect(computeBulkPrice(1990, { op: 'increase', value: 10, unit: 'percent', roundUpTens: true })).toBe(2190);
    expect(computeBulkPrice(1990, { op: 'decrease', value: 5, unit: 'percent', roundUpTens: true })).toBe(1890);
    expect(computeBulkPrice(1995, { op: 'decrease', value: 15, unit: 'percent' })).toBe(1696); // 299.25 → 299
    expect(computeBulkPrice(250, { op: 'increase', value: 1, unit: 'percent' })).toBe(253); // 2.5 → 3 (half up)
    expect(computeBulkPrice(5000, { op: 'decrease', value: 750, unit: 'dzd' })).toBe(4250);
    expect(computeBulkPrice(5000, { op: 'set', value: 4999, unit: 'dzd', roundUpTens: true })).toBe(5000);
    expect(computeBulkPrice(100, { op: 'decrease', value: 100, unit: 'percent' })).toBe(0); // the API refuses the line (price must stay > 0)
  });

  it('`set` takes an amount, percentages stay plausible', () => {
    const ids = ['018f0000-0000-7000-8000-000000000000'];
    expect(fields(BulkPriceSchema, { ids, op: 'set', value: 10, unit: 'percent' })).toEqual({ unit: 'validation.invalid' });
    expect(fields(BulkPriceSchema, { ids, op: 'increase', value: 1001, unit: 'percent' })).toEqual({ value: 'validation.range' });
    expect(fields(BulkPriceSchema, { ids: [], op: 'increase', value: 5, unit: 'percent' })).toEqual({ ids: 'validation.required' });
    expect(fields(BulkPriceSchema, { ids, op: 'increase', value: 5, unit: 'percent', preview: true })).toEqual({});
  });
});
