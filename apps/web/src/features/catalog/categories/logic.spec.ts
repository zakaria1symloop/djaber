import { describe, expect, it } from 'vitest';
import type { Category, Unit } from '../contracts';
import {
  canHaveParent,
  categoryDeleteMode,
  categoryRows,
  findCategory,
  parentOptions,
  reassignCategoryOptions,
  reassignUnitOptions,
  taxonomySummary,
  unitConversion,
  unitDeleteMode,
  unitLabel,
} from './logic';

const cat = (id: string, name: string, productCount = 0, children: Category[] = [], parentId: string | null = null): Category => ({
  id,
  name,
  description: null,
  color: '#a78bfa',
  parentId,
  imageUrl: null,
  productCount,
  children,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  actions: [],
});
const unit = (id: string, name: string, abbreviation: string, o: Partial<Unit> = {}): Unit => ({ id, name, abbreviation, isSystem: true, containsQty: null, baseUnitId: null, productCount: 0, actions: [], ...o });

const TREE = [cat('p', 'Parfums', 14, [cat('pf', 'Parfums femme', 6, [], 'p'), cat('ph', 'Parfums homme', 0, [], 'p')]), cat('v', 'Vêtements', 41), cat('s', 'Services', 0)];
const UNITS = [unit('pce', 'Pièce', 'pce'), unit('kg', 'Kilogramme', 'kg'), unit('dz', 'Douzaine', 'dz', { isSystem: false, containsQty: 12, baseUnitId: 'pce', productCount: 3 })];

describe('category tree', () => {
  it('flattens roots followed by their children', () => {
    expect(categoryRows(TREE).map((r) => `${r.depth}:${r.category.name}:${r.parent?.name ?? ''}`)).toEqual(['0:Parfums:', '1:Parfums femme:Parfums', '1:Parfums homme:Parfums', '0:Vêtements:', '0:Services:']);
    expect(findCategory(TREE, 'pf')?.name).toBe('Parfums femme');
    expect(findCategory(TREE, 'nope')).toBeNull();
    expect(findCategory(TREE, null)).toBeNull();
  });
  it('parent options: roots only, never itself; a parent of sub-categories stays a root', () => {
    expect(parentOptions(TREE, null).map((c) => c.id)).toEqual(['p', 'v', 's']);
    expect(parentOptions(TREE, 'v').map((c) => c.id)).toEqual(['p', 's']);
    expect(canHaveParent(TREE[0]!)).toBe(false);
    expect(canHaveParent(TREE[1]!)).toBe(true);
    expect(canHaveParent(null)).toBe(true);
  });
  it('summary counts every level', () => {
    expect(taxonomySummary(TREE, UNITS)).toEqual({ categories: 5, products: 61, systemUnits: 2, customUnits: 1 });
  });
});

describe('delete', () => {
  it('plain confirm only when nothing is attached', () => {
    expect(categoryDeleteMode(TREE[2]!)).toBe('confirm');
    expect(categoryDeleteMode(TREE[1]!)).toBe('reassign');
    expect(categoryDeleteMode(cat('x', 'X', 0, [cat('y', 'Y')]))).toBe('reassign');
    expect(unitDeleteMode(UNITS[2]!)).toBe('reassign');
    expect(unitDeleteMode(UNITS[0]!)).toBe('confirm');
  });
  it('reassign targets exclude the deleted row; its children are listed as future roots', () => {
    expect(reassignCategoryOptions(TREE, 'v').map((o) => o.label)).toEqual(['Parfums', 'Parfums › Parfums femme', 'Parfums › Parfums homme', 'Services']);
    expect(reassignCategoryOptions(TREE, 'p').map((o) => o.label)).toEqual(['Parfums femme', 'Parfums homme', 'Vêtements', 'Services']);
    expect(reassignUnitOptions(UNITS, 'dz')).toEqual([
      { id: 'pce', label: 'Pièce · pce' },
      { id: 'kg', label: 'Kilogramme · kg' },
    ]);
  });
});

describe('units', () => {
  it('labels', () => {
    expect(unitLabel(UNITS[0]!)).toBe('Pièce · pce');
    expect(unitConversion(UNITS[2]!, UNITS)).toBe('12 × Pièce');
    expect(unitConversion(UNITS[0]!, UNITS)).toBeNull();
    expect(unitConversion({ containsQty: 6, baseUnitId: 'gone' }, UNITS)).toBeNull();
  });
});
