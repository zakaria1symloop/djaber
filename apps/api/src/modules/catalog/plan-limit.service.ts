// 02 §5 — `maxProducts` (−1 = unlimited): checked inside the creating transaction (04 §7) on product create, restore,
// duplicate, import commit and variant create. Usage = live products of the workspace, counted, never stored.
import { Injectable } from '@nestjs/common';
import { TenantContext, type Tx } from '@djaber/db';
import { AppException } from '../../core/errors/app.exception';

@Injectable()
export class PlanLimitService {
  /** Remaining product slots (Infinity when unlimited). Serialises concurrent creations of the workspace. */
  async productSlots(tx: Tx): Promise<{ limit: number; current: number; free: number }> {
    const t = TenantContext.get();
    const limit = t.limits.maxProducts;
    if (limit === -1) return { limit, current: 0, free: Number.POSITIVE_INFINITY };
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${t.workspaceId} || ':products-limit', 0))`;
    const current = await tx.product.count({ where: { deletedAt: null } });
    return { limit, current, free: Math.max(0, limit - current) };
  }

  /** `403 PLAN_LIMIT { resource: products, limit, current }` when `adding` more live products do not fit. */
  async assertProductSlots(tx: Tx, adding = 1) {
    const s = await this.productSlots(tx);
    // `adding = 0` (variant create): refused only when the workspace is already over its limit (after a downgrade)
    const refused = adding === 0 ? s.limit !== -1 && s.current > s.limit : s.free < adding;
    if (refused) throw new AppException('PLAN_LIMIT', { resource: 'products', limit: s.limit, current: s.current });
  }
}
