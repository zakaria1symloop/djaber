// Pure helpers of /categories (CAT-04): the 2-level tree as rows, parent choices, header counts, unit labels,
// delete mode (plain confirm vs reassign dialog). Unit tested (logic.spec.ts).
import type { Category, Unit } from '../contracts';

/** The 7 swatches of the edit sheet (design-token accents + neutral grey). */
export const CATEGORY_COLORS = [
  { key: 'violet', hex: '#a78bfa' },
  { key: 'yellow', hex: '#fbbf24' },
  { key: 'orange', hex: '#fb923c' },
  { key: 'blue', hex: '#60a5fa' },
  { key: 'green', hex: '#34d399' },
  { key: 'red', hex: '#f87171' },
  { key: 'grey', hex: '#a3a3a3' },
] as const;
export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLORS[0].hex;

export type CategoryRow = { category: Category; depth: 0 | 1; parent: Category | null };
/** Roots followed by their sub-categories (already alphabetical from the API). */
export const categoryRows = (tree: readonly Category[]): CategoryRow[] =>
  tree.flatMap((root) => [{ category: root, depth: 0 as const, parent: null }, ...(root.children ?? []).map((child) => ({ category: child, depth: 1 as const, parent: root }))]);

export const findCategory = (tree: readonly Category[], id: string | null | undefined): Category | null => (id ? (categoryRows(tree).find((r) => r.category.id === id)?.category ?? null) : null);

/** A category that has sub-categories cannot get a parent (2 levels max, CATEGORY_DEPTH_EXCEEDED). */
export const canHaveParent = (editing: Pick<Category, 'children'> | null): boolean => !(editing?.children?.length ?? 0);

/** Parent choices: root categories only, never the category itself. */
export const parentOptions = (tree: readonly Category[], editingId: string | null): Category[] => tree.filter((c) => !c.parentId && c.id !== editingId);

/** "5 catégories · 128 produits · 7 unités système + 2 personnalisées" */
export function taxonomySummary(tree: readonly Category[], units: readonly Unit[]) {
  const rows = categoryRows(tree);
  return {
    categories: rows.length,
    products: rows.reduce((sum, r) => sum + (r.category.productCount ?? 0), 0),
    systemUnits: units.filter((u) => u.isSystem).length,
    customUnits: units.filter((u) => !u.isSystem).length,
  };
}

/** "Pièce · pce" */
export const unitLabel = (u: Pick<Unit, 'name' | 'abbreviation'>): string => `${u.name} · ${u.abbreviation}`;

/** "6 × Pièce" for a packaging unit, null otherwise. */
export function unitConversion(u: Pick<Unit, 'containsQty' | 'baseUnitId'>, units: readonly Pick<Unit, 'id' | 'name'>[]): string | null {
  if (!u.containsQty || !u.baseUnitId) return null;
  const base = units.find((x) => x.id === u.baseUnitId);
  return base ? `${u.containsQty} × ${base.name}` : null;
}

/** Unused ⇒ plain confirmation; products or sub-categories attached ⇒ the reassign dialog. */
export const categoryDeleteMode = (c: Pick<Category, 'productCount' | 'children'>): 'confirm' | 'reassign' => ((c.productCount ?? 0) > 0 || (c.children?.length ?? 0) > 0 ? 'reassign' : 'confirm');
export const unitDeleteMode = (u: Pick<Unit, 'productCount'>): 'confirm' | 'reassign' => ((u.productCount ?? 0) > 0 ? 'reassign' : 'confirm');

/** Categories the products can be moved to: every other one ("Parfums › Parfums femme" for a sub-category). */
export const reassignCategoryOptions = (tree: readonly Category[], deletingId: string): { id: string; label: string }[] =>
  categoryRows(tree)
    .filter((r) => r.category.id !== deletingId)
    .map((r) => ({ id: r.category.id, label: r.parent && r.parent.id !== deletingId ? `${r.parent.name} › ${r.category.name}` : r.category.name }));

export const reassignUnitOptions = (units: readonly Unit[], deletingId: string): { id: string; label: string }[] => units.filter((u) => u.id !== deletingId).map((u) => ({ id: u.id, label: unitLabel(u) }));
