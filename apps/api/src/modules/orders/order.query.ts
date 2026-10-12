// 06 §10 "Commandes" / api-contract §4 OrdersQuery — the list filters (also used by `GET /orders/stats`, the export and
// saved views), the whitelisted sorts and the KPI tiles of ORD-05 v2 (KPIs follow the filters; 04 §4 named figures).
import { ORDER_SORTS, type OrderStatsView, type OrderStatusName, type OrdersQuery } from '@djaber/shared';
import { prisma, TenantContext, type Prisma } from '@djaber/db';
import { AppException } from '../../core/errors/app.exception';
import { lastDays, periodRange, type PeriodKey } from '../../core/time/period';

export type OrderFilters = Omit<OrdersQuery, 'page' | 'pageSize' | 'sort' | 'view'>;
const HOUR = 3600_000;
const DAY = 24 * HOUR;
const STATUSES: OrderStatusName[] = ['new', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled', 'returned'];

/** Prisma filter of the list; `omit` drops filters (the tab counts ignore the status filter they belong to). */
export const orderWhere = (q: OrderFilters, o: { omit?: (keyof OrderFilters)[]; now?: Date } = {}): Prisma.OrderWhereInput => {
  const has = (k: keyof OrderFilters) => !o.omit?.includes(k) && q[k] !== undefined;
  const and: Prisma.OrderWhereInput[] = [];
  const now = o.now ?? new Date();
  if (has('ids') && q.ids!.length) and.push({ id: { in: q.ids } });
  if (has('status') && q.status!.length) and.push({ status: { in: q.status } });
  if (has('confirmationStatus') && q.confirmationStatus!.length) and.push({ confirmationStatus: { in: q.confirmationStatus } });
  if (has('minCalls')) and.push({ callAttempts: { gte: q.minCalls } });
  if (has('neverCalled') && q.neverCalled) and.push({ callAttempts: 0 });
  if (has('paymentStatus') && q.paymentStatus!.length) and.push({ paymentStatus: { in: q.paymentStatus } });
  if (has('paymentMethod') && q.paymentMethod!.length) and.push({ paymentMethod: { in: q.paymentMethod } });
  if (has('deliveryStatus') && q.deliveryStatus!.length) and.push({ deliveryStatus: { in: q.deliveryStatus } });
  if (has('shipmentProvider') && q.shipmentProvider!.length) and.push({ shipments: { some: { provider: { in: q.shipmentProvider }, status: { notIn: ['cancelled'] } } } });
  if (has('source') && q.source!.length) and.push({ source: { in: q.source } });
  if (has('channelId') && q.channelId!.length) and.push({ channelId: { in: q.channelId } });
  if (has('agentId') && q.agentId!.length) and.push({ agentId: { in: q.agentId } });
  if (has('assigneeId')) {
    const a = q.assigneeId!;
    and.push({ assigneeId: a === 'none' ? null : a === 'me' ? (TenantContext.get().userId ?? '00000000-0000-0000-0000-000000000000') : a });
  }
  if (has('wilayaId') && q.wilayaId!.length) and.push({ wilayaId: { in: q.wilayaId } });
  if (has('isStopdesk')) and.push({ isStopdesk: q.isStopdesk });
  if (has('minTotal')) and.push({ total: { gte: q.minTotal } });
  if (has('maxTotal')) and.push({ total: { lte: q.maxTotal } });
  if (!o.omit?.includes('period') && (q.period || q.from || q.to)) {
    const r = periodRange({ period: q.period as PeriodKey | undefined, from: q.from, to: q.to }, now);
    if (r.gte || r.lt) and.push({ orderedAt: { ...(r.gte ? { gte: r.gte } : {}), ...(r.lt ? { lt: r.lt } : {}) } });
  }
  if (has('productId')) and.push({ items: { some: { productId: q.productId } } });
  if (has('riskLevel')) and.push({ riskLevel: q.riskLevel });
  if (has('clientId')) and.push({ clientId: q.clientId });
  if (has('callbackDue') && q.callbackDue) and.push({ confirmationStatus: 'callback', callbackAt: { lte: now } });
  if (has('hasRemaining') && q.hasRemaining !== undefined) {
    // remaining = total − amountPaid > 0 (column comparison: raw id filter)
    and.push(q.hasRemaining ? { paymentStatus: { in: ['unpaid', 'partial', 'pending_link'] }, total: { gt: 0 }, status: { notIn: ['cancelled', 'returned'] } } : { OR: [{ paymentStatus: { in: ['paid', 'refunded'] } }, { total: 0 }] });
  }
  if (has('q') && q.q && q.q.trim().length >= 2) {
    const term = q.q.trim();
    const contains = { contains: term, mode: 'insensitive' as const };
    const digits = term.replace(/[\s.\-+]/g, '');
    const phoneTerm = /^\d{3,}$/.test(digits) ? (digits.startsWith('213') ? `0${digits.slice(3)}` : digits) : null;
    and.push({
      OR: [
        { number: contains },
        { clientName: contains },
        ...(phoneTerm ? [{ clientPhone: { contains: phoneTerm } }, { clientPhone2: { contains: phoneTerm } }] : []),
        { notes: contains },
        { items: { some: { OR: [{ productName: contains }, { sku: contains }] } } },
      ],
    });
  }
  return and.length ? { AND: and } : {};
};

export const orderOrderBy = (sort: string | undefined): Prisma.OrderOrderByWithRelationInput[] => {
  const s = sort ?? '-orderedAt';
  const field = s.replace(/^-/, '');
  if (!(ORDER_SORTS as readonly string[]).includes(field)) throw new AppException('BAD_REQUEST');
  const dir = s.startsWith('-') ? 'desc' : 'asc';
  return [{ [field]: dir }, { id: 'desc' }];
};

/** KPI tiles of ORD-05 v2 for the filtered set (`byStatus` ignores the status filter: they are the tab counts). */
export const orderStats = async (q: OrderFilters, now: Date = new Date()): Promise<OrderStatsView> => {
  const where = orderWhere(q, { now });
  const tabWhere = orderWhere(q, { now, omit: ['status'] });
  const d30 = lastDays(30, now).current;
  const scoped = (extra: Prisma.OrderWhereInput): Prisma.OrderWhereInput => ({ AND: [where, extra] });
  const staleBefore = new Date(now.getTime() - 5 * DAY);
  const [total, toConfirm, noAnswer, uncalled, confirmedNotSent, inTransit, stale, delivered30, placed30, returns, revenue, pipeline, callbacks, byStatus, bySource] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.count({ where: scoped({ status: 'new' }) }),
    prisma.order.count({ where: scoped({ confirmationStatus: 'no_answer', status: { notIn: ['cancelled', 'returned', 'delivered'] } }) }),
    prisma.order.count({ where: scoped({ status: 'new', callAttempts: 0, orderedAt: { lt: new Date(now.getTime() - 2 * HOUR) } }) }),
    prisma.order.count({ where: scoped({ status: { in: ['confirmed', 'preparing'] }, deliveryStatus: 'not_sent' }) }),
    prisma.order.count({ where: scoped({ status: 'shipped', deliveryStatus: { in: ['sent', 'pending', 'in_transit', 'out_for_delivery'] } }) }),
    prisma.order.count({
      where: scoped({ status: 'shipped', shipments: { some: { status: { in: ['sent', 'picked_up', 'in_transit'] }, OR: [{ lastEventAt: { lt: staleBefore } }, { lastEventAt: null, createdAt: { lt: staleBefore } }] } } }),
    }),
    prisma.order.count({ where: scoped({ status: 'delivered', deliveredAt: { gte: d30.gte, lt: d30.lt } }) }),
    prisma.order.count({ where: scoped({ orderedAt: { gte: d30.gte, lt: d30.lt } }) }),
    prisma.order.count({ where: scoped({ status: 'returned' }) }),
    prisma.order.aggregate({ where: scoped({ status: 'delivered', deliveredAt: { gte: d30.gte, lt: d30.lt } }), _sum: { total: true } }),
    prisma.order.aggregate({ where: scoped({ status: { in: ['new', 'confirmed', 'preparing', 'shipped'] } }), _sum: { total: true } }),
    prisma.order.count({ where: scoped({ confirmationStatus: 'callback', callbackAt: { lte: now } }) }),
    prisma.order.groupBy({ by: ['status'], where: tabWhere, _count: { _all: true } }),
    prisma.order.groupBy({ by: ['source'], where, _count: { _all: true } }),
  ]);
  const statusCounts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<OrderStatusName, number>;
  for (const r of byStatus) statusCounts[r.status] = r._count._all;
  const sourceMix = { ai: 0, manual: 0, mobile: 0, api: 0, import: 0 };
  for (const r of bySource) sourceMix[r.source] = r._count._all;
  return {
    total,
    toConfirm,
    noAnswer,
    uncalledOver2h: uncalled,
    confirmedNotSent,
    inTransit,
    staleOver5d: stale,
    delivered30d: delivered30,
    deliveredPct30d: placed30 ? Math.round((delivered30 * 1000) / placed30) / 10 : 0,
    returns,
    revenue30d: revenue._sum.total ?? 0,
    pipeline: pipeline._sum.total ?? 0,
    callbacksDue: callbacks,
    byStatus: statusCounts,
    sourceMix,
  };
};
