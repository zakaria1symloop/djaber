// Catalogue lines of a purchase or a sale with their snapshots (04 §4 "prices snapshotted on lines").
// 422 VARIANT_REQUIRED on a variant product without variant (`items.N.variantId`), VARIANT_NOT_FOUND on a foreign
// variant, VALIDATION_ERROR on an unknown / archived product; purchases refuse untracked products (GDS-06 fix,
// 422 PURCHASE_UNTRACKED_PRODUCT {product}).
import type { Tx } from '@djaber/db';
import { AppException } from '../../core/errors/app.exception';

export type GdsLine = {
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string | null;
  /** catalogue price of the product / variant */
  price: number;
  costPrice: number | null;
  trackStock: boolean;
  quantity: number;
};

export async function resolveGdsLines(tx: Tx, items: { productId: string; variantId?: string | null; quantity: number }[], o: { purchase?: boolean; field?: string } = {}): Promise<GdsLine[]> {
  const field = o.field ?? 'items';
  const ids = [...new Set(items.map((i) => i.productId))];
  const products = await tx.product.findMany({ where: { id: { in: ids }, deletedAt: null }, include: { variants: { where: { deletedAt: null } } } });
  const by = new Map(products.map((p) => [p.id, p]));
  return items.map((i, n) => {
    const p = by.get(i.productId);
    if (!p) throw new AppException('VALIDATION_ERROR', {}, { [`${field}.${n}.productId`]: 'validation.invalid' });
    if (o.purchase && !p.trackStock) throw new AppException('PURCHASE_UNTRACKED_PRODUCT', { product: p.name }, { [`${field}.${n}.productId`]: 'validation.invalid' });
    if (p.hasVariants && !i.variantId) throw new AppException('VARIANT_REQUIRED', {}, { [`${field}.${n}.variantId`]: 'validation.required' });
    const v = i.variantId ? p.variants.find((x) => x.id === i.variantId) : null;
    if (i.variantId && !v) throw new AppException('VARIANT_NOT_FOUND', {}, { [`${field}.${n}.variantId`]: 'validation.invalid' });
    return {
      productId: p.id,
      variantId: v?.id ?? null,
      productName: p.name,
      variantName: v?.name ?? null,
      sku: v?.sku ?? p.sku,
      price: v?.price ?? p.price,
      costPrice: v?.costPrice ?? p.costPrice ?? null,
      trackStock: p.trackStock,
      quantity: i.quantity,
    };
  });
}
