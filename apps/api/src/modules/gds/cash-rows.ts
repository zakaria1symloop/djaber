// 04 §3 / §20 / GDS-08 — the money half of SaleEffects and PurchaseEffects: one PaymentEntry per recorded payment and
// its locked automatic cash row (`isAutomatic=true`, `sourceType=payment_entry`), the refund row of a cancelled sale,
// and the `amountPaid` recomputed from the entries (never incremented). Only the effects services call these functions
// (CLAUDE.md rule 5); they always run inside the caller's transaction.
import { TenantContext, type CashCategory, type CashMethod, type PaymentMethod, type Tx } from '@djaber/db';
import { deriveGdsPaymentStatus } from '@djaber/shared';
import type { OutboxService } from '../../core/outbox/outbox.service';
import { algiersDay } from '../../core/time/algiers';

const CASH_METHOD: Record<PaymentMethod, CashMethod> = { cash: 'cash', card: 'card', transfer: 'transfer', ccp: 'ccp', other: 'other' };
export const cashMethodOf = (m: PaymentMethod): CashMethod => CASH_METHOD[m];

/** 04 §20: an automatic row is dated on its effective date only while that day is open, else today (the cash moved today). */
export async function cashDate(tx: Tx, at: Date): Promise<Date> {
  const day = algiersDay(at);
  if (day === algiersDay()) return at;
  const closed = await tx.cashClosing.findFirst({ where: { day: new Date(`${day}T00:00:00Z`), reopenedAt: null }, select: { id: true } });
  return closed ? new Date() : at;
}

/** The member recorded on a payment entry (`createdById` is required): the acting user, else the workspace owner. */
export async function payerOf(tx: Tx): Promise<string> {
  const userId = TenantContext.get().userId;
  if (userId) return userId;
  const owner = await tx.membership.findFirst({ where: { workspaceId: TenantContext.workspaceId(), role: 'owner' }, select: { userId: true } });
  return owner!.userId;
}

export type PaymentRowInput = {
  sourceType: 'sale' | 'purchase';
  sourceId: string;
  /** document number shown as the cash row reference (`VNT-1001`, `ACH-1001`) */
  number: string;
  amount: number;
  method: PaymentMethod;
  reference?: string | null;
  note?: string | null;
  paidAt?: Date;
  description: string;
};

/**
 * One PaymentEntry + its locked cash row: a sale payment is an income `sale`, a purchase payment an expense `purchase`
 * (cash actually moved — GDS-08). Returns the entry.
 */
export async function writePayment(tx: Tx, outbox: OutboxService, p: PaymentRowInput) {
  if (p.amount <= 0) return null;
  const workspaceId = TenantContext.workspaceId();
  const paidAt = p.paidAt ?? new Date();
  const createdById = await payerOf(tx);
  const sale = p.sourceType === 'sale';
  const category: CashCategory = sale ? 'sale' : 'purchase';
  const cash = await tx.cashTransaction.create({
    data: { workspaceId, type: sale ? 'income' : 'expense', amount: p.amount, category, method: CASH_METHOD[p.method], reference: p.number, description: p.description, date: await cashDate(tx, paidAt), isAutomatic: true, sourceType: 'payment_entry', createdById },
  });
  const entry = await tx.paymentEntry.create({ data: { workspaceId, sourceType: p.sourceType, sourceId: p.sourceId, amount: p.amount, method: p.method, reference: p.reference ?? null, note: p.note ?? null, paidAt, createdById, cashTransactionId: cash.id } });
  await tx.cashTransaction.update({ where: { id: cash.id }, data: { sourceId: entry.id } });
  await emitCash(tx, outbox, cash.date, cash.id);
  return entry;
}

/** Removes the document's payment entries and their automatic cash rows (manual rows are never touched). */
export async function clearPayments(tx: Tx, outbox: OutboxService, sourceType: 'sale' | 'purchase', sourceId: string) {
  const entries = await tx.paymentEntry.findMany({ where: { sourceType, sourceId }, select: { id: true, cashTransactionId: true } });
  if (!entries.length) return 0;
  const cashIds = entries.map((e) => e.cashTransactionId).filter((x): x is string => !!x);
  await tx.paymentEntry.deleteMany({ where: { id: { in: entries.map((e) => e.id) } } });
  if (cashIds.length) await tx.cashTransaction.deleteMany({ where: { id: { in: cashIds }, isAutomatic: true } });
  await outbox.ws(tx, `ws:${TenantContext.workspaceId()}`, 'cash.updated', { day: algiersDay() }, `cash.updated:clear:${sourceType}:${sourceId}:${Date.now()}`);
  return entries.length;
}

/** Locked `refund` expense row of a cancelled sale whose money is given back (04 §20 "refund row if money was taken"). */
export async function writeRefund(tx: Tx, outbox: OutboxService, p: { sourceId: string; number: string; amount: number; method: PaymentMethod; description: string }) {
  if (p.amount <= 0) return null;
  const cash = await tx.cashTransaction.create({
    data: { workspaceId: TenantContext.workspaceId(), type: 'expense', amount: p.amount, category: 'refund', method: CASH_METHOD[p.method], reference: p.number, description: p.description, date: new Date(), isAutomatic: true, sourceType: 'sale', sourceId: p.sourceId, createdById: TenantContext.get().userId ?? null },
  });
  await emitCash(tx, outbox, cash.date, cash.id);
  return cash;
}

/** `amountPaid` = Σ entries (clamped 0..total); status derived (04 §1.4 applied to GDS documents). */
export async function recomputePaid(tx: Tx, sourceType: 'sale' | 'purchase', sourceId: string, total: number) {
  const sum = await tx.paymentEntry.aggregate({ where: { sourceType, sourceId }, _sum: { amount: true } });
  const amountPaid = Math.max(0, Math.min(sum._sum.amount ?? 0, total));
  return { amountPaid, paymentStatus: deriveGdsPaymentStatus(amountPaid, total) };
}

export function emitCash(tx: Tx, outbox: OutboxService, date: Date, key: string) {
  return outbox.ws(tx, `ws:${TenantContext.workspaceId()}`, 'cash.updated', { day: algiersDay(date) }, `cash.updated:${key}:${Date.now()}`);
}
