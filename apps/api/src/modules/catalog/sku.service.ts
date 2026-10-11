// 00-build-order §0 "SKU registry table": no table. One partial unique index per table (`Product_live_sku`,
// `ProductVariant_live_sku`) + this cross-table check inside the writing transaction, so a SKU is unique across the
// live products and variants of a workspace. Both the check and Prisma P2002 answer 409 PRODUCT_SKU_ALREADY_EXISTS.
import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { TenantContext, type Tx } from '@djaber/db';
import { skuTaken } from './catalog.util';

type Except = { productId?: string; variantIds?: string[] };

@Injectable()
export class SkuService {
  /**
   * Throws when one of `skus` is used by another live product or variant of the workspace.
   * A transaction-scoped advisory lock per (workspace, sku) closes the race the two partial indexes cannot see
   * (a product and a variant taking the same SKU at the same time); the matching rows are read `FOR SHARE`.
   */
  async assertFree(tx: Tx, skus: (string | null | undefined)[], except: Except = {}, field = 'sku') {
    const taken = await this.taken(tx, skus, except);
    if (taken.size) throw skuTaken(field);
  }

  /** Same check, returning the SKUs already used (the import reports them per row). */
  async taken(tx: Tx, skus: (string | null | undefined)[], except: Except = {}): Promise<Set<string>> {
    const list = [...new Set(skus.filter((s): s is string => !!s))].sort();
    if (!list.length) return new Set();
    const ws = TenantContext.workspaceId();
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(k.h) FROM (
        SELECT DISTINCT hashtextextended(${ws} || ':' || s, 0) AS h FROM unnest(${list}::text[]) AS s ORDER BY 1
      ) AS k`;
    const noProduct = except.productId ? [except.productId] : [];
    const noVariants = except.variantIds ?? [];
    const products = await tx.$queryRaw<{ sku: string }[]>`
      SELECT "sku" FROM "Product"
      WHERE "workspaceId" = ${ws}::uuid AND "deletedAt" IS NULL AND "sku" = ANY(${list}::text[]) AND "id" <> ALL(${noProduct}::uuid[])
      FOR SHARE`;
    const variants = await tx.$queryRaw<{ sku: string }[]>`
      SELECT "sku" FROM "ProductVariant"
      WHERE "workspaceId" = ${ws}::uuid AND "deletedAt" IS NULL AND "sku" = ANY(${list}::text[]) AND "id" <> ALL(${noVariants}::uuid[])
      FOR SHARE`;
    return new Set([...products, ...variants].map((r) => r.sku));
  }

  /** `PRD-7K3Q9AXB` — used when the form leaves the SKU empty (the caller still runs `assertFree`). */
  generate(prefix = 'PRD') {
    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let s = '';
    for (const b of randomBytes(8)) s += alphabet[b % alphabet.length];
    return `${prefix}-${s}`;
  }
}
