// 04 §3 "Purchase created / paid changed / received / cancelled" and 04 §20 (D64, R-M) — the ONE writer of a purchase's
// side effects: stock `in` movements reason `purchase` at every receipt with the weighted-average cost recomputed
// (product or variant level), automatic cash rows (PaymentEntry → locked expense `purchase`). Always inside the caller's
// transaction; PurchaseService and SupplierService never touch stock or cash themselves.
import { Injectable } from '@nestjs/common';
import { weightedAverageCost } from '@djaber/shared';
import type { PaymentMethod, Purchase, Tx } from '@djaber/db';
import { OutboxService } from '../../core/outbox/outbox.service';
import { StockService } from '../catalog/stock.service';
import { clearPayments, recomputePaid, writePayment } from './cash-rows';

@Injectable()
export class PurchaseEffects {
  constructor(
    private readonly stock: StockService,
    private readonly outbox: OutboxService,
  ) {}

  /**
   * One receipt of `qty` units of a line: `in` movement, then `costPrice = round_half_up((stock × cost + qty × unitCost)
   * / (stock + qty))` with `stock` = the quantity before the receipt (AT-GDS-16). Returns the new cost.
   */
  async receive(tx: Tx, purchase: Pick<Purchase, 'id' | 'number'>, line: { productId: string; variantId: string | null; unitCost: number }, qty: number) {
    if (qty <= 0) return null;
    const r = await this.stock.move(tx, {
      productId: line.productId,
      variantId: line.variantId,
      change: { delta: qty },
      type: 'in',
      reason: 'purchase',
      note: purchase.number,
      refType: 'purchase',
      refId: purchase.id,
    });
    if (line.variantId) {
      const v = await tx.productVariant.findUniqueOrThrow({ where: { id: line.variantId }, select: { costPrice: true } });
      const cost = weightedAverageCost(r.before, v.costPrice, qty, line.unitCost);
      await tx.productVariant.update({ where: { id: line.variantId }, data: { costPrice: cost } });
      return cost;
    }
    const p = await tx.product.findUniqueOrThrow({ where: { id: line.productId }, select: { costPrice: true } });
    const cost = weightedAverageCost(r.before, p.costPrice, qty, line.unitCost);
    await tx.product.update({ where: { id: line.productId }, data: { costPrice: cost } });
    return cost;
  }

  addPayment(tx: Tx, purchase: Pick<Purchase, 'id' | 'number'>, p: { amount: number; method: PaymentMethod; reference?: string | null; note?: string | null; paidAt?: Date; description: string }) {
    return writePayment(tx, this.outbox, { sourceType: 'purchase', sourceId: purchase.id, number: purchase.number, ...p });
  }

  /** Cancel of a purchase nothing was received on (04 §3): payment entries and their automatic rows removed. */
  clearPayments(tx: Tx, purchaseId: string) {
    return clearPayments(tx, this.outbox, 'purchase', purchaseId);
  }

  recomputePaid(tx: Tx, purchase: Pick<Purchase, 'id' | 'total'>) {
    return recomputePaid(tx, 'purchase', purchase.id, purchase.total);
  }
}
