import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { getWilayaById } from '../data/wilayas';
import { resolveWindow } from '../utils/period';

// ============================================================================
// Reports suite — /api/user-stock/reports/*
// Response shapes MUST match the frontend contract in src/lib/reports-api.ts.
// Everything is scoped by req.user.userId. All Decimals are wrapped in Number().
//
// Revenue convention (matches the rest of the app):
//   revenue = ALL Sale rows (counted at saleDate) + Orders with status
//   'delivered' (counted at orderDate). Cancelled/returned orders NEVER count.
//   Sales have no cancel state (a cancelled sale is deleted), so every Sale row
//   in the window is revenue.
// ============================================================================

// Order statuses that never contribute to revenue / payments received.
const EXCLUDED_ORDER_STATUSES = ['cancelled', 'returned'];

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Time-series scaffolding (daily buckets; monthly buckets for 'year')
// ---------------------------------------------------------------------------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = (n: number): string => String(n).padStart(2, '0');
const dayKey = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const monthKey = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
const dayLabel = (key: string): string => {
  const [, m, day] = key.split('-');
  return `${day} ${MONTHS[Number(m) - 1]}`;
};
const monthLabel = (key: string): string => {
  const [, m] = key.split('-');
  return MONTHS[Number(m) - 1];
};

interface SeriesScaffold {
  keys: string[];
  keyOf: (d: Date) => string;
  labelOf: (key: string) => string;
}

const buildSeries = (start: Date, end: Date, bucket: 'day' | 'month'): SeriesScaffold => {
  const isMonthly = bucket === 'month';
  const keys: string[] = [];
  const cursor = isMonthly
    ? new Date(start.getFullYear(), start.getMonth(), 1)
    : new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endBound = isMonthly
    ? new Date(end.getFullYear(), end.getMonth(), 1)
    : new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cursor <= endBound) {
    keys.push(isMonthly ? monthKey(cursor) : dayKey(cursor));
    if (isMonthly) cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }
  return {
    keys,
    keyOf: (d: Date) => (isMonthly ? monthKey(d) : dayKey(d)),
    labelOf: (key: string) => (isMonthly ? monthLabel(key) : dayLabel(key)),
  };
};

// Build an empty bucket map keyed by every scaffold key.
const emptyBuckets = <T>(scaffold: SeriesScaffold, init: () => T): Map<string, T> => {
  const m = new Map<string, T>();
  for (const k of scaffold.keys) m.set(k, init());
  return m;
};

// Turn a bucket map into ordered TimePoint[] ({ date, label, ...metrics }).
const toPoints = <T extends Record<string, number>>(
  scaffold: SeriesScaffold,
  map: Map<string, T>
): Array<{ date: string; label: string } & T> =>
  scaffold.keys.map((k) => ({ date: k, label: scaffold.labelOf(k), ...(map.get(k) as T) }));

// ---------------------------------------------------------------------------
// Cost lookups (product + variant cost prices), scoped to the user.
// ---------------------------------------------------------------------------
interface CostMaps {
  productCost: Map<string, number>;
  variantCost: Map<string, number>;
}

const fetchCostMaps = async (userId: string): Promise<CostMaps> => {
  const [products, variants] = await Promise.all([
    prisma.product.findMany({ where: { userId }, select: { id: true, costPrice: true } }),
    prisma.productVariant.findMany({
      where: { product: { userId } },
      select: { id: true, costPrice: true },
    }),
  ]);
  const productCost = new Map<string, number>();
  for (const p of products) productCost.set(p.id, Number(p.costPrice) || 0);
  const variantCost = new Map<string, number>();
  for (const v of variants) variantCost.set(v.id, Number(v.costPrice) || 0);
  return { productCost, variantCost };
};

// Cost of a single sold line (variant cost wins when the line carries variantId).
const lineCost = (
  maps: CostMaps,
  productId: string,
  variantId: string | null | undefined,
  quantity: number
): number => {
  const unit =
    (variantId != null ? maps.variantCost.get(variantId) : undefined) ??
    maps.productCost.get(productId) ??
    0;
  return unit * quantity;
};

const unauthorized = (res: Response): void => {
  res.status(401).json({ error: 'Unauthorized' });
};

// ============================================================================
// FINANCE — Profit & Loss
// ============================================================================
export const getProfitLossReport = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return unauthorized(res);
    const userId = req.user.userId;
    const { period, start, end, bucket, dateFilter } = resolveWindow(
      req.query.period,
      req.query.startDate,
      req.query.endDate
    );
    const scaffold = buildSeries(start, end, bucket);

    const [sales, orders, caisseExpense, productExpense, maps] = await Promise.all([
      prisma.sale.findMany({
        where: { userId, saleDate: dateFilter },
        select: { total: true, saleDate: true, items: { select: { productId: true, quantity: true } } },
      }),
      prisma.order.findMany({
        where: { userId, status: 'delivered', orderDate: dateFilter },
        select: {
          total: true,
          deliveryFee: true,
          orderDate: true,
          items: { select: { productId: true, variantId: true, quantity: true } },
        },
      }),
      prisma.caisseTransaction.aggregate({
        where: { userId, type: 'expense', date: dateFilter },
        _sum: { amount: true },
      }),
      prisma.productExpense.aggregate({
        where: { userId, date: dateFilter },
        _sum: { amount: true },
      }),
      fetchCostMaps(userId),
    ]);

    const buckets = emptyBuckets(scaffold, () => ({ revenue: 0, profit: 0 }));
    let revenue = 0;
    let cogs = 0;
    let deliveryCosts = 0;

    for (const s of sales) {
      const rev = Number(s.total) || 0;
      let cost = 0;
      for (const it of s.items) cost += lineCost(maps, it.productId, null, it.quantity);
      revenue += rev;
      cogs += cost;
      const b = buckets.get(scaffold.keyOf(s.saleDate));
      if (b) {
        b.revenue += rev;
        b.profit += rev - cost;
      }
    }
    for (const o of orders) {
      const rev = Number(o.total) || 0;
      let cost = 0;
      for (const it of o.items) cost += lineCost(maps, it.productId, it.variantId, it.quantity);
      revenue += rev;
      cogs += cost;
      deliveryCosts += Number(o.deliveryFee) || 0;
      const b = buckets.get(scaffold.keyOf(o.orderDate));
      if (b) {
        b.revenue += rev;
        b.profit += rev - cost;
      }
    }

    const expenses = (Number(caisseExpense._sum.amount) || 0) + (Number(productExpense._sum.amount) || 0);
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - expenses - deliveryCosts;

    const breakdown = [
      { id: 'revenue', label: 'Revenue', value: revenue },
      { id: 'cogs', label: 'Cost of Goods', value: -cogs },
      { id: 'gross', label: 'Gross Profit', value: grossProfit },
      { id: 'expenses', label: 'Expenses', value: -expenses },
      { id: 'delivery', label: 'Delivery Costs', value: -deliveryCosts },
      { id: 'net', label: 'Net Profit', value: netProfit },
    ];

    res.json({
      period,
      revenue,
      cogs,
      grossProfit,
      grossMarginPct: revenue > 0 ? (grossProfit / revenue) * 100 : null,
      expenses,
      deliveryCosts,
      netProfit,
      netMarginPct: revenue > 0 ? (netProfit / revenue) * 100 : null,
      breakdown,
      series: toPoints(scaffold, buckets),
    });
  } catch (error) {
    console.error('Get profit-loss report error:', error);
    res.status(500).json({ error: 'Failed to fetch profit & loss report' });
  }
};

// ============================================================================
// FINANCE — Cash Flow
// ============================================================================
export const getCashFlowReport = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return unauthorized(res);
    const userId = req.user.userId;
    const { period, start, end, bucket, dateFilter } = resolveWindow(
      req.query.period,
      req.query.startDate,
      req.query.endDate
    );
    const scaffold = buildSeries(start, end, bucket);

    const [txns, priorIncome, priorExpense] = await Promise.all([
      prisma.caisseTransaction.findMany({
        where: { userId, date: dateFilter },
        select: { type: true, amount: true, category: true, date: true },
      }),
      prisma.caisseTransaction.aggregate({
        where: { userId, type: 'income', date: { lt: start } },
        _sum: { amount: true },
      }),
      prisma.caisseTransaction.aggregate({
        where: { userId, type: 'expense', date: { lt: start } },
        _sum: { amount: true },
      }),
    ]);

    const openingBalance = (Number(priorIncome._sum.amount) || 0) - (Number(priorExpense._sum.amount) || 0);

    const buckets = emptyBuckets(scaffold, () => ({ in: 0, out: 0 }));
    const categoryMap = new Map<string, { net: number; count: number }>();
    let totalIn = 0;
    let totalOut = 0;

    for (const t of txns) {
      const amt = Number(t.amount) || 0;
      const isIncome = t.type === 'income';
      if (isIncome) totalIn += amt;
      else totalOut += amt;
      const b = buckets.get(scaffold.keyOf(t.date));
      if (b) {
        if (isIncome) b.in += amt;
        else b.out += amt;
      }
      const cat = categoryMap.get(t.category) || { net: 0, count: 0 };
      cat.net += isIncome ? amt : -amt;
      cat.count += 1;
      categoryMap.set(t.category, cat);
    }

    const net = totalIn - totalOut;

    // Running balance series (opening + cumulative net through each bucket).
    let running = openingBalance;
    const series = scaffold.keys.map((k) => {
      const b = buckets.get(k) as { in: number; out: number };
      running += b.in - b.out;
      return { date: k, label: scaffold.labelOf(k), in: b.in, out: b.out, balance: running };
    });

    // Signed net per category (income positive, expense negative), ranked by magnitude.
    const byCategory = [...categoryMap.entries()]
      .map(([category, c]) => ({ id: category, label: category, value: c.net, secondary: c.count }))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

    res.json({
      period,
      totalIn,
      totalOut,
      net,
      openingBalance,
      closingBalance: openingBalance + net,
      series,
      byCategory,
    });
  } catch (error) {
    console.error('Get cash-flow report error:', error);
    res.status(500).json({ error: 'Failed to fetch cash flow report' });
  }
};

// ============================================================================
// FINANCE — Cash Register (raw caisse ledger)
// ============================================================================
export const getCashRegisterReport = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return unauthorized(res);
    const userId = req.user.userId;
    const { period, dateFilter } = resolveWindow(
      req.query.period,
      req.query.startDate,
      req.query.endDate
    );

    const where = { userId, date: dateFilter };
    const [incomeAgg, expenseAgg, count, rows] = await Promise.all([
      prisma.caisseTransaction.aggregate({ where: { ...where, type: 'income' }, _sum: { amount: true } }),
      prisma.caisseTransaction.aggregate({ where: { ...where, type: 'expense' }, _sum: { amount: true } }),
      prisma.caisseTransaction.count({ where }),
      prisma.caisseTransaction.findMany({
        where,
        orderBy: { date: 'desc' },
        take: 500,
        select: {
          id: true,
          date: true,
          type: true,
          category: true,
          amount: true,
          reference: true,
          description: true,
          isAutomatic: true,
        },
      }),
    ]);

    const income = Number(incomeAgg._sum.amount) || 0;
    const expense = Number(expenseAgg._sum.amount) || 0;

    res.json({
      period,
      income,
      expense,
      balance: income - expense,
      count,
      rows: rows.map((r) => ({
        id: r.id,
        date: r.date.toISOString(),
        type: r.type as 'income' | 'expense',
        category: r.category,
        amount: Number(r.amount) || 0,
        reference: r.reference,
        description: r.description,
        isAutomatic: r.isAutomatic,
      })),
    });
  } catch (error) {
    console.error('Get cash-register report error:', error);
    res.status(500).json({ error: 'Failed to fetch cash register report' });
  }
};

// ============================================================================
// FINANCE — Payments & Transactions
// ============================================================================
export const getPaymentsReport = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return unauthorized(res);
    const userId = req.user.userId;
    const { period, start, end, bucket, dateFilter } = resolveWindow(
      req.query.period,
      req.query.startDate,
      req.query.endDate
    );
    const scaffold = buildSeries(start, end, bucket);

    const [sales, orders, purchases] = await Promise.all([
      prisma.sale.findMany({
        where: { userId, saleDate: dateFilter },
        select: { amountPaid: true, paymentMethod: true, saleDate: true },
      }),
      prisma.order.findMany({
        where: { userId, orderDate: dateFilter, status: { notIn: EXCLUDED_ORDER_STATUSES } },
        select: { amountPaid: true, paymentMethod: true, orderDate: true },
      }),
      prisma.purchase.findMany({
        where: { userId, purchaseDate: dateFilter, status: { not: 'cancelled' } },
        select: { amountPaid: true, purchaseDate: true },
      }),
    ]);

    const buckets = emptyBuckets(scaffold, () => ({ received: 0, paidOut: 0 }));
    const methodMap = new Map<string, number>();
    let salesReceived = 0;
    let ordersReceived = 0;
    let paidOut = 0;

    for (const s of sales) {
      const amt = Number(s.amountPaid) || 0;
      salesReceived += amt;
      methodMap.set(s.paymentMethod, (methodMap.get(s.paymentMethod) || 0) + amt);
      const b = buckets.get(scaffold.keyOf(s.saleDate));
      if (b) b.received += amt;
    }
    for (const o of orders) {
      const amt = Number(o.amountPaid) || 0;
      ordersReceived += amt;
      methodMap.set(o.paymentMethod, (methodMap.get(o.paymentMethod) || 0) + amt);
      const b = buckets.get(scaffold.keyOf(o.orderDate));
      if (b) b.received += amt;
    }
    for (const p of purchases) {
      const amt = Number(p.amountPaid) || 0;
      paidOut += amt;
      const b = buckets.get(scaffold.keyOf(p.purchaseDate));
      if (b) b.paidOut += amt;
    }

    const received = salesReceived + ordersReceived;

    const byMethod = [...methodMap.entries()]
      .map(([method, value]) => ({ id: method, label: method, value }))
      .sort((a, b) => b.value - a.value);

    const bySource = [
      { id: 'sales', label: 'Sales', value: salesReceived },
      { id: 'orders', label: 'Orders', value: ordersReceived },
      { id: 'purchases', label: 'Purchases', value: paidOut },
    ].sort((a, b) => b.value - a.value);

    res.json({
      period,
      received,
      paidOut,
      net: received - paidOut,
      byMethod,
      bySource,
      series: toPoints(scaffold, buckets),
    });
  } catch (error) {
    console.error('Get payments report error:', error);
    res.status(500).json({ error: 'Failed to fetch payments report' });
  }
};

// ============================================================================
// FINANCE — Expenses
// ============================================================================
export const getExpensesReport = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return unauthorized(res);
    const userId = req.user.userId;
    const { period, start, end, bucket, dateFilter } = resolveWindow(
      req.query.period,
      req.query.startDate,
      req.query.endDate
    );
    const scaffold = buildSeries(start, end, bucket);

    const [caisse, productExpenses] = await Promise.all([
      prisma.caisseTransaction.findMany({
        where: { userId, type: 'expense', date: dateFilter },
        select: { id: true, date: true, category: true, description: true, amount: true },
      }),
      prisma.productExpense.findMany({
        where: { userId, date: dateFilter },
        select: { id: true, date: true, category: true, description: true, amount: true },
      }),
    ]);

    const buckets = emptyBuckets(scaffold, () => ({ amount: 0 }));
    const categoryMap = new Map<string, number>();
    let total = 0;

    type Row = {
      id: string;
      date: string;
      category: string;
      description: string | null;
      amount: number;
      source: 'caisse' | 'product';
    };
    const rows: Row[] = [];

    const ingest = (
      id: string,
      date: Date,
      category: string,
      description: string | null,
      amount: number,
      source: 'caisse' | 'product'
    ) => {
      total += amount;
      categoryMap.set(category, (categoryMap.get(category) || 0) + amount);
      const b = buckets.get(scaffold.keyOf(date));
      if (b) b.amount += amount;
      rows.push({ id, date: date.toISOString(), category, description, amount, source });
    };

    for (const c of caisse) ingest(c.id, c.date, c.category, c.description, Number(c.amount) || 0, 'caisse');
    // ProductExpense.amount is stored as-is (per-unit flag not expanded here).
    for (const p of productExpenses)
      ingest(p.id, p.date, p.category, p.description, Number(p.amount) || 0, 'product');

    rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    const byCategory = [...categoryMap.entries()]
      .map(([category, value]) => ({ id: category, label: category, value }))
      .sort((a, b) => b.value - a.value);

    res.json({
      period,
      total,
      byCategory,
      series: toPoints(scaffold, buckets),
      rows,
    });
  } catch (error) {
    console.error('Get expenses report error:', error);
    res.status(500).json({ error: 'Failed to fetch expenses report' });
  }
};

// ============================================================================
// FINANCE — Tax Summary
// ============================================================================
export const getTaxSummaryReport = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return unauthorized(res);
    const userId = req.user.userId;
    const { period, start, end, bucket, dateFilter } = resolveWindow(
      req.query.period,
      req.query.startDate,
      req.query.endDate
    );
    const scaffold = buildSeries(start, end, bucket);

    const [sales, orders] = await Promise.all([
      prisma.sale.findMany({
        where: { userId, saleDate: dateFilter },
        select: { tax: true, total: true, saleDate: true },
      }),
      prisma.order.findMany({
        where: { userId, status: 'delivered', orderDate: dateFilter },
        select: { tax: true, total: true, orderDate: true },
      }),
    ]);

    const buckets = emptyBuckets(scaffold, () => ({ tax: 0 }));
    let salesTax = 0;
    let ordersTax = 0;
    let taxableRevenue = 0;

    for (const s of sales) {
      const t = Number(s.tax) || 0;
      salesTax += t;
      taxableRevenue += Number(s.total) || 0;
      const b = buckets.get(scaffold.keyOf(s.saleDate));
      if (b) b.tax += t;
    }
    for (const o of orders) {
      const t = Number(o.tax) || 0;
      ordersTax += t;
      taxableRevenue += Number(o.total) || 0;
      const b = buckets.get(scaffold.keyOf(o.orderDate));
      if (b) b.tax += t;
    }

    const taxCollected = salesTax + ordersTax;

    res.json({
      period,
      taxCollected,
      taxableRevenue,
      effectiveRatePct: taxableRevenue > 0 ? (taxCollected / taxableRevenue) * 100 : null,
      series: toPoints(scaffold, buckets),
      bySource: [
        { id: 'sales', label: 'Sales Tax', value: salesTax },
        { id: 'orders', label: 'Orders Tax', value: ordersTax },
      ].sort((a, b) => b.value - a.value),
    });
  } catch (error) {
    console.error('Get tax-summary report error:', error);
    res.status(500).json({ error: 'Failed to fetch tax summary report' });
  }
};

// ============================================================================
// FINANCE — Discount Summary
// ============================================================================
export const getDiscountsReport = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return unauthorized(res);
    const userId = req.user.userId;
    const { period, start, end, bucket, dateFilter } = resolveWindow(
      req.query.period,
      req.query.startDate,
      req.query.endDate
    );
    const scaffold = buildSeries(start, end, bucket);

    const [sales, orders, products] = await Promise.all([
      prisma.sale.findMany({
        where: { userId, saleDate: dateFilter },
        select: {
          discount: true,
          total: true,
          saleDate: true,
          items: { select: { productId: true, discount: true } },
        },
      }),
      prisma.order.findMany({
        where: { userId, status: 'delivered', orderDate: dateFilter },
        select: {
          discount: true,
          total: true,
          orderDate: true,
          items: { select: { productId: true, discount: true } },
        },
      }),
      prisma.product.findMany({ where: { userId }, select: { id: true, name: true, sku: true } }),
    ]);

    const productInfo = new Map(products.map((p) => [p.id, { name: p.name, sku: p.sku }]));
    const buckets = emptyBuckets(scaffold, () => ({ discount: 0 }));
    const perProduct = new Map<string, number>();
    let totalDiscount = 0;
    let discountedRevenue = 0;

    for (const s of sales) {
      const orderLevel = Number(s.discount) || 0;
      let itemLevel = 0;
      for (const it of s.items) {
        const d = Number(it.discount) || 0;
        itemLevel += d;
        if (d) perProduct.set(it.productId, (perProduct.get(it.productId) || 0) + d);
      }
      totalDiscount += orderLevel + itemLevel;
      discountedRevenue += Number(s.total) || 0;
      const b = buckets.get(scaffold.keyOf(s.saleDate));
      if (b) b.discount += orderLevel + itemLevel;
    }
    for (const o of orders) {
      const orderLevel = Number(o.discount) || 0;
      totalDiscount += orderLevel;
      discountedRevenue += Number(o.total) || 0;
      // Per-product attribution uses OrderItem.discount (order-level discount
      // has no product to attribute to).
      for (const it of o.items) {
        const d = Number(it.discount) || 0;
        if (d) perProduct.set(it.productId, (perProduct.get(it.productId) || 0) + d);
      }
      const b = buckets.get(scaffold.keyOf(o.orderDate));
      if (b) b.discount += orderLevel;
    }

    const topDiscountedProducts = [...perProduct.entries()]
      .map(([productId, value]) => {
        const info = productInfo.get(productId);
        return { id: productId, label: info?.name ?? 'Unknown', sublabel: info?.sku, value };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);

    res.json({
      period,
      totalDiscount,
      discountedRevenue,
      discountRatePct: discountedRevenue > 0 ? (totalDiscount / discountedRevenue) * 100 : null,
      topDiscountedProducts,
      series: toPoints(scaffold, buckets),
    });
  } catch (error) {
    console.error('Get discounts report error:', error);
    res.status(500).json({ error: 'Failed to fetch discount summary report' });
  }
};

// ============================================================================
// SALES — Sales Report
// ============================================================================
export const getSalesReport = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return unauthorized(res);
    const userId = req.user.userId;
    const { period, start, end, bucket, dateFilter } = resolveWindow(
      req.query.period,
      req.query.startDate,
      req.query.endDate
    );
    const scaffold = buildSeries(start, end, bucket);

    const [sales, orders] = await Promise.all([
      prisma.sale.findMany({
        where: { userId, saleDate: dateFilter },
        select: {
          total: true,
          saleDate: true,
          paymentStatus: true,
          items: { select: { quantity: true } },
        },
      }),
      prisma.order.findMany({
        where: { userId, status: 'delivered', orderDate: dateFilter },
        select: {
          total: true,
          orderDate: true,
          source: true,
          paymentStatus: true,
          items: { select: { quantity: true } },
        },
      }),
    ]);

    const buckets = emptyBuckets(scaffold, () => ({ revenue: 0, orders: 0 }));
    const channelMap = new Map<string, { revenue: number; count: number }>([
      ['walkin', { revenue: 0, count: 0 }],
      ['ai', { revenue: 0, count: 0 }],
      ['manual', { revenue: 0, count: 0 }],
    ]);
    const statusMap = new Map<string, { revenue: number; count: number }>();

    let revenue = 0;
    let itemsSold = 0;
    const orderCount = sales.length + orders.length;

    for (const s of sales) {
      const rev = Number(s.total) || 0;
      revenue += rev;
      for (const it of s.items) itemsSold += it.quantity;
      const ch = channelMap.get('walkin')!;
      ch.revenue += rev;
      ch.count += 1;
      const st = statusMap.get(s.paymentStatus) || { revenue: 0, count: 0 };
      st.revenue += rev;
      st.count += 1;
      statusMap.set(s.paymentStatus, st);
      const b = buckets.get(scaffold.keyOf(s.saleDate));
      if (b) {
        b.revenue += rev;
        b.orders += 1;
      }
    }
    for (const o of orders) {
      const rev = Number(o.total) || 0;
      revenue += rev;
      for (const it of o.items) itemsSold += it.quantity;
      const ch = channelMap.get(o.source === 'ai' ? 'ai' : 'manual')!;
      ch.revenue += rev;
      ch.count += 1;
      const st = statusMap.get(o.paymentStatus) || { revenue: 0, count: 0 };
      st.revenue += rev;
      st.count += 1;
      statusMap.set(o.paymentStatus, st);
      const b = buckets.get(scaffold.keyOf(o.orderDate));
      if (b) {
        b.revenue += rev;
        b.orders += 1;
      }
    }

    const byChannel = [
      { id: 'walkin', label: 'Walk-in Sales', value: channelMap.get('walkin')!.revenue, secondary: channelMap.get('walkin')!.count },
      { id: 'ai', label: 'AI Orders', value: channelMap.get('ai')!.revenue, secondary: channelMap.get('ai')!.count },
      { id: 'manual', label: 'Manual Orders', value: channelMap.get('manual')!.revenue, secondary: channelMap.get('manual')!.count },
    ].sort((a, b) => b.value - a.value);

    const byPaymentStatus = [...statusMap.entries()]
      .map(([status, v]) => ({ id: status, label: status, value: v.revenue, secondary: v.count }))
      .sort((a, b) => b.value - a.value);

    res.json({
      period,
      revenue,
      orders: orderCount,
      avgOrderValue: orderCount > 0 ? revenue / orderCount : null,
      itemsSold,
      series: toPoints(scaffold, buckets),
      byChannel,
      byPaymentStatus,
    });
  } catch (error) {
    console.error('Get sales report error:', error);
    res.status(500).json({ error: 'Failed to fetch sales report' });
  }
};

// ============================================================================
// SALES — Sales by Category
// ============================================================================
export const getSalesByCategoryReport = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return unauthorized(res);
    const userId = req.user.userId;
    const { period, dateFilter } = resolveWindow(
      req.query.period,
      req.query.startDate,
      req.query.endDate
    );

    const [products, saleItems, orderItems] = await Promise.all([
      prisma.product.findMany({
        where: { userId },
        select: { id: true, category: { select: { name: true } } },
      }),
      prisma.saleItem.groupBy({
        by: ['productId'],
        where: { sale: { userId, saleDate: dateFilter } },
        _sum: { total: true, quantity: true },
      }),
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: { userId, status: 'delivered', orderDate: dateFilter } },
        _sum: { total: true, quantity: true },
      }),
    ]);

    const categoryOf = new Map<string, string>();
    for (const p of products) categoryOf.set(p.id, p.category?.name ?? 'Uncategorized');

    const catMap = new Map<string, { revenue: number; units: number }>();
    let total = 0;
    for (const row of [...saleItems, ...orderItems]) {
      const cat = categoryOf.get(row.productId) ?? 'Uncategorized';
      const rev = Number(row._sum.total) || 0;
      const units = Number(row._sum.quantity) || 0;
      const c = catMap.get(cat) || { revenue: 0, units: 0 };
      c.revenue += rev;
      c.units += units;
      catMap.set(cat, c);
      total += rev;
    }

    const categories = [...catMap.entries()]
      .map(([name, c]) => ({ id: name, label: name, value: c.revenue, secondary: c.units }))
      .sort((a, b) => b.value - a.value);

    res.json({ period, total, categories });
  } catch (error) {
    console.error('Get sales-by-category report error:', error);
    res.status(500).json({ error: 'Failed to fetch sales by category report' });
  }
};

// ============================================================================
// SALES — Top Selling Products
// ============================================================================
export const getTopProductsReport = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return unauthorized(res);
    const userId = req.user.userId;
    const { period, dateFilter } = resolveWindow(
      req.query.period,
      req.query.startDate,
      req.query.endDate
    );

    const [products, saleItems, orderItems, maps] = await Promise.all([
      prisma.product.findMany({ where: { userId }, select: { id: true, name: true, sku: true } }),
      prisma.saleItem.findMany({
        where: { sale: { userId, saleDate: dateFilter } },
        select: { productId: true, quantity: true, total: true },
      }),
      prisma.orderItem.findMany({
        where: { order: { userId, status: 'delivered', orderDate: dateFilter } },
        select: { productId: true, variantId: true, quantity: true, total: true },
      }),
      fetchCostMaps(userId),
    ]);

    const info = new Map(products.map((p) => [p.id, { name: p.name, sku: p.sku }]));
    const agg = new Map<string, { units: number; revenue: number; cogs: number }>();
    const bump = (productId: string, units: number, revenue: number, cogs: number) => {
      const a = agg.get(productId) || { units: 0, revenue: 0, cogs: 0 };
      a.units += units;
      a.revenue += revenue;
      a.cogs += cogs;
      agg.set(productId, a);
    };

    for (const it of saleItems)
      bump(it.productId, it.quantity, Number(it.total) || 0, lineCost(maps, it.productId, null, it.quantity));
    for (const it of orderItems)
      bump(it.productId, it.quantity, Number(it.total) || 0, lineCost(maps, it.productId, it.variantId, it.quantity));

    const productsOut = [...agg.entries()]
      .map(([productId, a]) => {
        const profit = a.revenue - a.cogs;
        const marginPct = a.revenue > 0 ? (profit / a.revenue) * 100 : 0;
        const meta = info.get(productId);
        return {
          id: productId,
          label: meta?.name ?? 'Unknown',
          sublabel: meta?.sku,
          value: a.revenue,
          secondary: a.units,
          extra: { units: a.units, revenue: a.revenue, cogs: a.cogs, profit, marginPct },
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 50);

    res.json({ period, products: productsOut });
  } catch (error) {
    console.error('Get top-products report error:', error);
    res.status(500).json({ error: 'Failed to fetch top products report' });
  }
};

// ============================================================================
// SALES — Return Ratio
// ============================================================================
export const getReturnRatioReport = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return unauthorized(res);
    const userId = req.user.userId;
    const { period, start, end, bucket, dateFilter } = resolveWindow(
      req.query.period,
      req.query.startDate,
      req.query.endDate
    );
    const scaffold = buildSeries(start, end, bucket);

    const orders = await prisma.order.findMany({
      where: { userId, orderDate: dateFilter },
      select: { status: true, total: true, orderDate: true, wilayaId: true },
    });

    const buckets = emptyBuckets(scaffold, () => ({ delivered: 0, cancelled: 0, returned: 0 }));
    const wilayaMap = new Map<number, { orders: number; returned: number }>();

    let created = 0;
    let delivered = 0;
    let cancelled = 0;
    let returned = 0;
    let lostRevenue = 0;

    for (const o of orders) {
      created += 1;
      const b = buckets.get(scaffold.keyOf(o.orderDate));
      if (o.status === 'delivered') {
        delivered += 1;
        if (b) b.delivered += 1;
      } else if (o.status === 'cancelled') {
        cancelled += 1;
        lostRevenue += Number(o.total) || 0;
        if (b) b.cancelled += 1;
      } else if (o.status === 'returned') {
        returned += 1;
        lostRevenue += Number(o.total) || 0;
        if (b) b.returned += 1;
      }
      if (o.wilayaId != null) {
        const w = wilayaMap.get(o.wilayaId) || { orders: 0, returned: 0 };
        w.orders += 1;
        if (o.status === 'returned') w.returned += 1;
        wilayaMap.set(o.wilayaId, w);
      }
    }

    const byWilaya = [...wilayaMap.entries()]
      .map(([wilayaId, w]) => ({
        id: String(wilayaId),
        label: getWilayaById(wilayaId)?.nameFr ?? `Wilaya ${wilayaId}`,
        value: w.orders > 0 ? (w.returned / w.orders) * 100 : 0,
        secondary: w.orders,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);

    res.json({
      period,
      created,
      delivered,
      cancelled,
      returned,
      cancelRatePct: created > 0 ? (cancelled / created) * 100 : null,
      returnRatePct: created > 0 ? (returned / created) * 100 : null,
      fulfilmentRatePct: created > 0 ? (delivered / created) * 100 : null,
      lostRevenue,
      series: toPoints(scaffold, buckets),
      byWilaya,
    });
  } catch (error) {
    console.error('Get return-ratio report error:', error);
    res.status(500).json({ error: 'Failed to fetch return ratio report' });
  }
};

// ============================================================================
// PURCHASES — Purchases Report
// ============================================================================
export const getPurchasesReport = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return unauthorized(res);
    const userId = req.user.userId;
    const { period, start, end, bucket, dateFilter } = resolveWindow(
      req.query.period,
      req.query.startDate,
      req.query.endDate
    );
    const scaffold = buildSeries(start, end, bucket);

    const purchases = await prisma.purchase.findMany({
      where: { userId, purchaseDate: dateFilter, status: { not: 'cancelled' } },
      select: { total: true, amountPaid: true, status: true, purchaseDate: true },
    });

    const buckets = emptyBuckets(scaffold, () => ({ committed: 0, paid: 0 }));
    const statusMap = new Map<string, { committed: number; count: number }>();
    let committed = 0;
    let paid = 0;

    for (const p of purchases) {
      const total = Number(p.total) || 0;
      const amountPaid = Number(p.amountPaid) || 0;
      committed += total;
      paid += amountPaid;
      const st = statusMap.get(p.status) || { committed: 0, count: 0 };
      st.committed += total;
      st.count += 1;
      statusMap.set(p.status, st);
      const b = buckets.get(scaffold.keyOf(p.purchaseDate));
      if (b) {
        b.committed += total;
        b.paid += amountPaid;
      }
    }

    const byStatus = [...statusMap.entries()]
      .map(([status, v]) => ({ id: status, label: status, value: v.committed, secondary: v.count }))
      .sort((a, b) => b.value - a.value);

    res.json({
      period,
      committed,
      paid,
      outstanding: committed - paid,
      count: purchases.length,
      byStatus,
      series: toPoints(scaffold, buckets),
    });
  } catch (error) {
    console.error('Get purchases report error:', error);
    res.status(500).json({ error: 'Failed to fetch purchases report' });
  }
};

// ============================================================================
// PURCHASES — Product Purchases
// ============================================================================
export const getProductPurchasesReport = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return unauthorized(res);
    const userId = req.user.userId;
    const { period, dateFilter } = resolveWindow(
      req.query.period,
      req.query.startDate,
      req.query.endDate
    );

    const [products, items] = await Promise.all([
      prisma.product.findMany({ where: { userId }, select: { id: true, name: true, sku: true } }),
      prisma.purchaseItem.groupBy({
        by: ['productId'],
        where: { purchase: { userId, purchaseDate: dateFilter, status: { not: 'cancelled' } } },
        _sum: { total: true, quantity: true },
      }),
    ]);

    const info = new Map(products.map((p) => [p.id, { name: p.name, sku: p.sku }]));
    let total = 0;
    const rows = items.map((row) => {
      const cost = Number(row._sum.total) || 0;
      const units = Number(row._sum.quantity) || 0;
      total += cost;
      const meta = info.get(row.productId);
      return { id: row.productId, label: meta?.name ?? 'Unknown', sublabel: meta?.sku, value: cost, secondary: units };
    });
    rows.sort((a, b) => b.value - a.value);

    res.json({ period, total, products: rows.slice(0, 100) });
  } catch (error) {
    console.error('Get product-purchases report error:', error);
    res.status(500).json({ error: 'Failed to fetch product purchases report' });
  }
};

// ============================================================================
// SUPPLIERS — Suppliers / Top Suppliers (shared builder)
// ============================================================================
const buildSuppliersReport = async (
  req: Request,
  res: Response,
  limit: number | null
): Promise<void> => {
  if (!req.user) return unauthorized(res);
  const userId = req.user.userId;
  const { period, dateFilter } = resolveWindow(
    req.query.period,
    req.query.startDate,
    req.query.endDate
  );

  const [suppliers, grouped] = await Promise.all([
    prisma.supplier.findMany({ where: { userId }, select: { id: true, name: true } }),
    prisma.purchase.groupBy({
      by: ['supplierId'],
      where: { userId, purchaseDate: dateFilter, status: { not: 'cancelled' }, supplierId: { not: null } },
      _sum: { total: true, amountPaid: true },
      _count: { _all: true },
    }),
  ]);

  const nameOf = new Map(suppliers.map((s) => [s.id, s.name]));
  let total = 0;
  const rows = grouped.map((g) => {
    const spend = Number(g._sum.total) || 0;
    const outstanding = spend - (Number(g._sum.amountPaid) || 0);
    const purchases = g._count._all;
    total += spend;
    const supplierId = g.supplierId as string;
    return {
      id: supplierId,
      label: nameOf.get(supplierId) ?? 'Unknown supplier',
      value: spend,
      secondary: purchases,
      extra: { purchases, spend, outstanding },
    };
  });
  rows.sort((a, b) => b.value - a.value);

  res.json({ period, total, suppliers: limit == null ? rows : rows.slice(0, limit) });
};

export const getSuppliersReport = async (req: Request, res: Response): Promise<void> => {
  try {
    await buildSuppliersReport(req, res, null);
  } catch (error) {
    console.error('Get suppliers report error:', error);
    res.status(500).json({ error: 'Failed to fetch suppliers report' });
  }
};

export const getTopSuppliersReport = async (req: Request, res: Response): Promise<void> => {
  try {
    await buildSuppliersReport(req, res, 10);
  } catch (error) {
    console.error('Get top-suppliers report error:', error);
    res.status(500).json({ error: 'Failed to fetch top suppliers report' });
  }
};

// ============================================================================
// INVENTORY — Inventory Valuation (variant-aware)
// ============================================================================
export const getInventoryValuationReport = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return unauthorized(res);
    const userId = req.user.userId;

    const products = await prisma.product.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        quantity: true,
        costPrice: true,
        sellingPrice: true,
        hasVariants: true,
        category: { select: { name: true } },
        variants: { select: { quantity: true, costPrice: true, sellingPrice: true } },
      },
    });

    let costValue = 0;
    let retailValue = 0;
    let totalUnits = 0;
    const catMap = new Map<string, { costValue: number; units: number }>();
    const perProduct: Array<{ id: string; name: string; sku: string; cost: number; units: number }> = [];

    for (const p of products) {
      let cost = 0;
      let retail = 0;
      let units = 0;
      if (p.hasVariants && p.variants.length > 0) {
        for (const v of p.variants) {
          cost += v.quantity * (Number(v.costPrice) || 0);
          retail += v.quantity * (Number(v.sellingPrice) || 0);
          units += v.quantity;
        }
      } else {
        cost = p.quantity * (Number(p.costPrice) || 0);
        retail = p.quantity * (Number(p.sellingPrice) || 0);
        units = p.quantity;
      }
      costValue += cost;
      retailValue += retail;
      totalUnits += units;

      const catName = p.category?.name ?? 'Uncategorized';
      const c = catMap.get(catName) || { costValue: 0, units: 0 };
      c.costValue += cost;
      c.units += units;
      catMap.set(catName, c);

      perProduct.push({ id: p.id, name: p.name, sku: p.sku, cost, units });
    }

    const byCategory = [...catMap.entries()]
      .map(([name, c]) => ({ id: name, label: name, value: c.costValue, secondary: c.units }))
      .sort((a, b) => b.value - a.value);

    const topByValue = perProduct
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 20)
      .map((p) => ({ id: p.id, label: p.name, sublabel: p.sku, value: p.cost, secondary: p.units }));

    res.json({
      costValue,
      retailValue,
      potentialProfit: retailValue - costValue,
      totalUnits,
      productCount: products.length,
      byCategory,
      topByValue,
    });
  } catch (error) {
    console.error('Get inventory-valuation report error:', error);
    res.status(500).json({ error: 'Failed to fetch inventory valuation report' });
  }
};

// ============================================================================
// INVENTORY — Stock Alerts (product-level for v1; variants not yet checked)
// ============================================================================
export const getStockAlertsReport = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return unauthorized(res);
    const userId = req.user.userId;

    const products = await prisma.product.findMany({
      where: { userId, isActive: true },
      select: { id: true, name: true, sku: true, quantity: true, minQuantity: true },
    });

    const lowStock: Array<{ id: string; name: string; sku: string; quantity: number; minQuantity: number }> = [];
    const negativeStock: Array<{ id: string; name: string; sku: string; quantity: number }> = [];
    const outOfStock: Array<{ id: string; name: string; sku: string; minQuantity: number }> = [];

    for (const p of products) {
      if (p.quantity < 0) {
        negativeStock.push({ id: p.id, name: p.name, sku: p.sku, quantity: p.quantity });
      }
      if (p.quantity === 0) {
        outOfStock.push({ id: p.id, name: p.name, sku: p.sku, minQuantity: p.minQuantity });
      } else if (p.quantity > 0 && p.quantity <= p.minQuantity) {
        lowStock.push({ id: p.id, name: p.name, sku: p.sku, quantity: p.quantity, minQuantity: p.minQuantity });
      }
    }

    res.json({
      lowStock,
      negativeStock,
      outOfStock,
      counts: { low: lowStock.length, negative: negativeStock.length, out: outOfStock.length },
    });
  } catch (error) {
    console.error('Get stock-alerts report error:', error);
    res.status(500).json({ error: 'Failed to fetch stock alerts report' });
  }
};

// ============================================================================
// INVENTORY — Dead & Zero-Sales Stock
// ============================================================================
export const getDeadStockReport = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return unauthorized(res);
    const userId = req.user.userId;
    const { period, dateFilter } = resolveWindow(
      req.query.period,
      req.query.startDate,
      req.query.endDate
    );

    const [products, soldSale, soldOrder] = await Promise.all([
      prisma.product.findMany({
        where: { userId, isActive: true, quantity: { gt: 0 } },
        select: { id: true, name: true, sku: true, quantity: true, costPrice: true },
      }),
      prisma.saleItem.groupBy({
        by: ['productId'],
        where: { sale: { userId, saleDate: dateFilter } },
        _sum: { quantity: true },
      }),
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: { userId, status: 'delivered', orderDate: dateFilter } },
        _sum: { quantity: true },
      }),
    ]);

    const soldIds = new Set<string>();
    for (const r of [...soldSale, ...soldOrder]) {
      if ((Number(r._sum.quantity) || 0) > 0) soldIds.add(r.productId);
    }

    const dead = products
      .filter((p) => !soldIds.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        quantity: p.quantity,
        stockValue: p.quantity * (Number(p.costPrice) || 0),
      }));

    const deadStockValue = dead.reduce((sum, p) => sum + p.stockValue, 0);

    const items = [...dead].sort((a, b) => b.stockValue - a.stockValue).slice(0, 100);

    // lastSoldAt (latest sale/order EVER) for the returned items, in one query.
    const ids = items.map((p) => p.id);
    const lastSoldMap = new Map<string, string>();
    if (ids.length > 0) {
      const rows = await prisma.$queryRaw<Array<{ productId: string; lastDate: Date | string | null }>>(Prisma.sql`
        SELECT productId, MAX(d) as lastDate FROM (
          SELECT oi.productId AS productId, o.orderDate AS d
          FROM OrderItem oi
          INNER JOIN \`Order\` o ON o.id = oi.orderId
          WHERE o.userId = ${userId} AND oi.productId IN (${Prisma.join(ids)})
          UNION ALL
          SELECT si.productId AS productId, s.saleDate AS d
          FROM SaleItem si
          INNER JOIN Sale s ON s.id = si.saleId
          WHERE s.userId = ${userId} AND si.productId IN (${Prisma.join(ids)})
        ) t
        GROUP BY productId
      `);
      for (const row of rows) {
        if (row.lastDate) lastSoldMap.set(row.productId, new Date(row.lastDate).toISOString());
      }
    }

    res.json({
      period,
      deadStockValue,
      items: items.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        quantity: p.quantity,
        stockValue: p.stockValue,
        lastSoldAt: lastSoldMap.get(p.id) ?? null,
      })),
      zeroSales: dead.map((p) => ({ id: p.id, name: p.name, sku: p.sku, quantity: p.quantity })),
    });
  } catch (error) {
    console.error('Get dead-stock report error:', error);
    res.status(500).json({ error: 'Failed to fetch dead stock report' });
  }
};

// ============================================================================
// INVENTORY — Stock Aging
// ============================================================================
export const getStockAgingReport = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return unauthorized(res);
    const userId = req.user.userId;

    const [products, movements] = await Promise.all([
      prisma.product.findMany({
        where: { userId, isActive: true, quantity: { gt: 0 } },
        select: { id: true, name: true, sku: true, quantity: true, costPrice: true, createdAt: true },
      }),
      prisma.stockMovement.groupBy({
        by: ['productId'],
        where: { userId },
        _max: { createdAt: true },
      }),
    ]);

    const lastMoved = new Map<string, Date>();
    for (const m of movements) if (m._max.createdAt) lastMoved.set(m.productId, m._max.createdAt);

    const now = Date.now();
    const bucketDefs = [
      { id: '0-30', label: '0-30d', max: 30 },
      { id: '31-60', label: '31-60d', max: 60 },
      { id: '61-90', label: '61-90d', max: 90 },
      { id: '90+', label: '90d+', max: Infinity },
    ];
    const bucketAgg = new Map<string, { stockValue: number; units: number }>(
      bucketDefs.map((b) => [b.id, { stockValue: 0, units: 0 }])
    );

    const items = products.map((p) => {
      const movedAt = lastMoved.get(p.id) ?? p.createdAt;
      const ageDays = Math.floor((now - movedAt.getTime()) / DAY_MS);
      const stockValue = p.quantity * (Number(p.costPrice) || 0);
      const def = bucketDefs.find((b) => ageDays <= b.max) ?? bucketDefs[bucketDefs.length - 1];
      const agg = bucketAgg.get(def.id)!;
      agg.stockValue += stockValue;
      agg.units += p.quantity;
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        quantity: p.quantity,
        stockValue,
        lastMovedAt: movedAt.toISOString(),
        ageDays,
      };
    });

    const buckets = bucketDefs.map((b) => {
      const agg = bucketAgg.get(b.id)!;
      return { id: b.id, label: b.label, value: agg.stockValue, secondary: agg.units };
    });

    const topItems = items.sort((a, b) => b.ageDays - a.ageDays).slice(0, 100);

    res.json({ buckets, items: topItems });
  } catch (error) {
    console.error('Get stock-aging report error:', error);
    res.status(500).json({ error: 'Failed to fetch stock aging report' });
  }
};

// ============================================================================
// INVENTORY — Stock Adjustments (audit trail)
// ============================================================================
export const getStockAdjustmentsReport = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return unauthorized(res);
    const userId = req.user.userId;
    const { period, dateFilter } = resolveWindow(
      req.query.period,
      req.query.startDate,
      req.query.endDate
    );

    const movements = await prisma.stockMovement.findMany({
      where: { userId, type: 'adjustment', createdAt: dateFilter },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        createdAt: true,
        quantity: true,
        reason: true,
        product: { select: { name: true } },
        variant: { select: { name: true } },
      },
    });

    let totalIn = 0;
    let totalOut = 0;
    for (const m of movements) {
      if (m.quantity >= 0) totalIn += m.quantity;
      else totalOut += Math.abs(m.quantity);
    }

    res.json({
      period,
      totalIn,
      totalOut,
      count: movements.length,
      rows: movements.map((m) => ({
        id: m.id,
        date: m.createdAt.toISOString(),
        productName: m.product?.name ?? 'Unknown',
        variantName: m.variant?.name ?? null,
        quantity: m.quantity,
        reason: m.reason,
      })),
    });
  } catch (error) {
    console.error('Get stock-adjustments report error:', error);
    res.status(500).json({ error: 'Failed to fetch stock adjustments report' });
  }
};

// ============================================================================
// INVENTORY — Products Report (full catalog)
// ============================================================================
export const getProductsReport = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return unauthorized(res);
    const userId = req.user.userId;

    const products = await prisma.product.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        sku: true,
        quantity: true,
        costPrice: true,
        sellingPrice: true,
        isActive: true,
        hasVariants: true,
        category: { select: { name: true } },
      },
    });

    let activeCount = 0;
    let totalUnits = 0;
    let costValue = 0;
    let retailValue = 0;

    const rows = products.map((p) => {
      const cost = Number(p.costPrice) || 0;
      const selling = Number(p.sellingPrice) || 0;
      const stockValue = p.quantity * cost;
      if (p.isActive) activeCount += 1;
      totalUnits += p.quantity;
      costValue += stockValue;
      retailValue += p.quantity * selling;
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category?.name ?? null,
        quantity: p.quantity,
        costPrice: cost,
        sellingPrice: selling,
        stockValue,
        isActive: p.isActive,
        hasVariants: p.hasVariants,
      };
    });

    rows.sort((a, b) => b.stockValue - a.stockValue);

    res.json({
      productCount: products.length,
      activeCount,
      totalUnits,
      costValue,
      retailValue,
      rows: rows.slice(0, 500),
    });
  } catch (error) {
    console.error('Get products report error:', error);
    res.status(500).json({ error: 'Failed to fetch products report' });
  }
};

// ============================================================================
// CUSTOMERS — Top Customers (spend within the selected period)
// ============================================================================
export const getTopCustomersReport = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return unauthorized(res);
    const userId = req.user.userId;
    const { period, dateFilter } = resolveWindow(
      req.query.period,
      req.query.startDate,
      req.query.endDate
    );

    const grouped = await prisma.order.groupBy({
      by: ['clientId'],
      where: { userId, status: 'delivered', orderDate: dateFilter, clientId: { not: null } },
      _sum: { total: true },
      _count: { _all: true },
    });

    const clientIds = grouped.map((g) => g.clientId as string);
    const clients = clientIds.length
      ? await prisma.client.findMany({
          where: { userId, id: { in: clientIds } },
          select: { id: true, name: true, phone: true, source: true, lastOrderDate: true },
        })
      : [];
    const clientInfo = new Map(clients.map((c) => [c.id, c]));

    let total = 0;
    const customers = grouped
      .map((g) => {
        const clientId = g.clientId as string;
        const spent = Number(g._sum.total) || 0;
        const orders = g._count._all;
        total += spent;
        const info = clientInfo.get(clientId);
        return {
          id: clientId,
          label: info?.name ?? 'Unknown',
          sublabel: info?.phone ?? undefined,
          value: spent,
          secondary: orders,
          extra: {
            orders,
            spent,
            lastOrderDate: info?.lastOrderDate ? info.lastOrderDate.toISOString() : null,
            source: info?.source ?? 'manual',
          },
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 50);

    res.json({ period, total, customers });
  } catch (error) {
    console.error('Get top-customers report error:', error);
    res.status(500).json({ error: 'Failed to fetch top customers report' });
  }
};

// ============================================================================
// CUSTOMERS — Inactive Customers
// ============================================================================
export const getInactiveCustomersReport = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return unauthorized(res);
    const userId = req.user.userId;

    const parsed = parseInt(String(req.query.days ?? ''), 10);
    const thresholdDays = Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
    const now = Date.now();
    const thresholdDate = new Date(now - thresholdDays * DAY_MS);

    const clients = await prisma.client.findMany({
      where: {
        userId,
        OR: [
          { lastOrderDate: { lt: thresholdDate } },
          { lastOrderDate: null, totalOrders: { gt: 0 } },
        ],
      },
      select: { id: true, name: true, phone: true, totalOrders: true, totalSpent: true, lastOrderDate: true },
    });

    let lostValue = 0;
    const customers = clients.map((c) => {
      const totalSpent = Number(c.totalSpent) || 0;
      lostValue += totalSpent;
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        totalOrders: c.totalOrders,
        totalSpent,
        lastOrderDate: c.lastOrderDate ? c.lastOrderDate.toISOString() : null,
        daysSince: c.lastOrderDate ? Math.floor((now - c.lastOrderDate.getTime()) / DAY_MS) : null,
      };
    });

    customers.sort((a, b) => b.totalSpent - a.totalSpent);

    res.json({
      thresholdDays,
      count: customers.length,
      lostValue,
      customers: customers.slice(0, 500),
    });
  } catch (error) {
    console.error('Get inactive-customers report error:', error);
    res.status(500).json({ error: 'Failed to fetch inactive customers report' });
  }
};
