// Small helpers shared by the GDS services (suppliers, purchases, sales, cash, inventories).
import { prisma, Prisma, TenantContext, type Tx } from '@djaber/db';
import type { GdsProductRef, OrderUserRef, PaymentEntryView } from '@djaber/shared';
import { AppException, validationError } from '../../core/errors/app.exception';
import { periodRange, type PeriodKey } from '../../core/time/period';
import { thumbUrlOf } from '../catalog/product-image.util';

export const USER_SELECT = { id: true, firstName: true, lastName: true, avatarUrl: true } as const;
export const userRef = (u: { id: string; firstName: string; lastName: string; avatarUrl: string | null } | null | undefined): OrderUserRef | null =>
  u ? { id: u.id, firstName: u.firstName, lastName: u.lastName, avatarUrl: u.avatarUrl } : null;

export const PRODUCT_REF_SELECT = {
  id: true,
  name: true,
  sku: true,
  price: true,
  hasVariants: true,
  trackStock: true,
  images: { where: { isPrimary: true }, take: 1, select: { url: true } },
} satisfies Prisma.ProductSelect;
type ProductRefRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_REF_SELECT }>;
export const productRef = (p: ProductRefRow): GdsProductRef => ({
  id: p.id,
  name: p.name,
  sku: p.sku,
  price: p.price,
  primaryImageUrl: p.images[0] ? thumbUrlOf(p.images[0].url) : null,
  hasVariants: p.hasVariants,
  trackStock: p.trackStock,
});

export const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const DAY_MS = 86_400_000;
/** 04 §2 "Dates": business dates (`purchasedAt`, `soldAt`) are ≤ now + 1 day. */
export const checkBusinessDate = (raw: string | undefined, field: string): Date | undefined => {
  if (raw === undefined) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime()) || d.getTime() > Date.now() + DAY_MS) throw validationError({ [field]: 'validation.date' });
  return d;
};

/** `[gte, lt)` of a list query (`period` preset or `from` / `to`), Africa/Algiers. */
export const rangeOf = (q: { period?: string; from?: string; to?: string }) => periodRange({ period: q.period as PeriodKey | undefined, from: q.from, to: q.to });
export const dateWhere = (q: { period?: string; from?: string; to?: string }) => {
  const r = rangeOf(q);
  return r.gte || r.lt ? { ...(r.gte ? { gte: r.gte } : {}), ...(r.lt ? { lt: r.lt } : {}) } : undefined;
};

/** Whitelisted `sort` (leading `-` = desc); unknown field ⇒ 400 BAD_REQUEST (api-contract §1.6). Ties broken by id. */
export const sortOf = <T extends string>(sort: string | undefined, allowed: readonly T[], fallback: string) => {
  const s = sort ?? fallback;
  const field = s.replace(/^-/, '');
  if (!(allowed as readonly string[]).includes(field)) throw new AppException('BAD_REQUEST');
  const dir: 'asc' | 'desc' = s.startsWith('-') ? 'desc' : 'asc';
  return { field: field as T, dir };
};

export const paymentView = (p: { id: string; amount: number; method: PaymentEntryView['method']; reference: string | null; note: string | null; paidAt: Date; createdBy?: { id: string; firstName: string; lastName: string; avatarUrl: string | null } | null }): PaymentEntryView => ({
  id: p.id,
  amount: p.amount,
  method: p.method,
  reference: p.reference,
  note: p.note,
  paidAt: p.paidAt.toISOString(),
  createdBy: userRef(p.createdBy ?? null),
});

/** Payment entries of documents of one type, grouped by document id (oldest first). */
export const paymentsOf = async (sourceType: 'sale' | 'purchase', ids: string[]) => {
  if (!ids.length) return new Map<string, PaymentEntryView[]>();
  const rows = await prisma.paymentEntry.findMany({ where: { sourceType, sourceId: { in: ids } }, include: { createdBy: { select: USER_SELECT } }, orderBy: [{ paidAt: 'asc' }, { id: 'asc' }] });
  const by = new Map<string, PaymentEntryView[]>();
  for (const r of rows) by.set(r.sourceId, [...(by.get(r.sourceId) ?? []), paymentView(r)]);
  return by;
};

/** Row-lock a document of the workspace (`SELECT … FOR UPDATE`); 404 across workspaces. */
export const lockRow = async (tx: Tx, table: 'Purchase' | 'Sale' | 'Supplier' | 'InventoryCount' | 'CashTransaction', id: string) => {
  const rows = await tx.$queryRawUnsafe<{ id: string }[]>(`SELECT "id" FROM "${table}" WHERE "id" = $1::uuid AND "workspaceId" = $2::uuid FOR UPDATE`, id, TenantContext.workspaceId());
  return rows.length > 0;
};

/** Percentage change, one decimal; null when there is no previous value. */
export const deltaPct = (current: number, previous: number): number | null => (previous > 0 ? Math.round(((current - previous) * 1000) / previous) / 10 : null);
