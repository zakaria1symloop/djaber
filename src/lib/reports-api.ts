// ============================================================================
// Reports API client — /api/user-stock/reports/*
// Single source of truth for the reporting suite. Backend controller
// (reports.controller.ts) and every report view import from here.
// Money is DA; all amounts are numbers (backend does Number() on Decimals).
// ============================================================================

import { apiRequest } from './api-config';

export type ReportPeriod = 'today' | 'week' | 'month' | 'year';
/** Period accepted by the fetchers — presets plus 'custom' (used with explicit dates). */
export type ReportPeriodParam = ReportPeriod | 'custom';
/** Optional explicit custom date range (YYYY-MM-DD). Backend prefers these over `period`. */
export type RangeOpts = { startDate?: string; endDate?: string };

// A point on a time series (daily buckets for today/week/month, monthly for year).
export interface TimePoint {
  date: string; // YYYY-MM-DD (first-of-month for 'year')
  label: string; // short human label for the axis (e.g. "05 Jul", "Jul")
  [metric: string]: string | number;
}

// A ranked/breakdown row (product, category, customer, supplier…).
export interface RankRow {
  id: string;
  label: string; // display name
  sublabel?: string; // sku, phone, category…
  value: number; // primary metric the bar scales to
  secondary?: number; // optional second metric (e.g. units)
  extra?: Record<string, number | string>;
}

function q(period: ReportPeriodParam, opts?: RangeOpts, extra?: Record<string, string>): string {
  const params = new URLSearchParams({ period, ...(extra || {}) });
  if (opts?.startDate) params.set('startDate', opts.startDate);
  if (opts?.endDate) params.set('endDate', opts.endDate);
  return params.toString();
}

// ---------------------------------------------------------------------------
// The catalog (what the hub renders). status: 'ready' | 'soon'.
// ---------------------------------------------------------------------------
export interface ReportMeta {
  key: string;
  title: string;
  description: string;
  category: 'finance' | 'sales' | 'purchases' | 'inventory' | 'customers' | 'suppliers';
  status: 'ready' | 'soon';
  soonReason?: string; // why it's not available (missing data model)
}

export const REPORT_CATALOG: ReportMeta[] = [
  // Finance
  { key: 'profit-loss', title: 'Profit & Loss', description: 'Revenue, cost of goods, expenses and net profit for the period.', category: 'finance', status: 'ready' },
  { key: 'cash-flow', title: 'Cash Flow', description: 'Money in vs money out over time, with running balance.', category: 'finance', status: 'ready' },
  { key: 'cash-register', title: 'Cash Register', description: 'Every caisse transaction: income, expenses and balance.', category: 'finance', status: 'ready' },
  { key: 'payments', title: 'Payments & Transactions', description: 'All payments received and paid across sales, orders and purchases.', category: 'finance', status: 'ready' },
  { key: 'expenses', title: 'Expenses', description: 'Spending by category — operating costs and per-product expenses.', category: 'finance', status: 'ready' },
  { key: 'tax-summary', title: 'Tax Summary', description: 'Tax collected on sales and orders for the period.', category: 'finance', status: 'ready' },
  { key: 'discounts', title: 'Discount Summary', description: 'Discounts given on sales and orders, and their revenue impact.', category: 'finance', status: 'ready' },
  // Sales
  { key: 'sales', title: 'Sales Report', description: 'Sales and delivered orders: revenue, volume and trend.', category: 'sales', status: 'ready' },
  { key: 'sales-by-category', title: 'Sales by Category', description: 'Which product categories drive revenue.', category: 'sales', status: 'ready' },
  { key: 'top-products', title: 'Top Selling Products', description: 'Best sellers by revenue and units, with margin.', category: 'sales', status: 'ready' },
  { key: 'return-ratio', title: 'Return Ratio', description: 'Order return and cancellation rates — the COD cost.', category: 'sales', status: 'ready' },
  // Purchases
  { key: 'purchases', title: 'Purchases Report', description: 'Purchase orders: committed vs paid, by status and over time.', category: 'purchases', status: 'ready' },
  { key: 'product-purchases', title: 'Product Purchases', description: 'What you restock most, by quantity and cost.', category: 'purchases', status: 'ready' },
  // Suppliers
  { key: 'suppliers', title: 'Suppliers Report', description: 'Every supplier with spend and purchase count.', category: 'suppliers', status: 'ready' },
  { key: 'top-suppliers', title: 'Top Suppliers', description: 'Your biggest suppliers by total spend.', category: 'suppliers', status: 'ready' },
  // Inventory
  { key: 'inventory-valuation', title: 'Inventory Valuation', description: 'Stock value at cost and retail, by category.', category: 'inventory', status: 'ready' },
  { key: 'stock-alerts', title: 'Stock Alerts', description: 'Low stock, negative stock and out-of-stock products.', category: 'inventory', status: 'ready' },
  { key: 'dead-stock', title: 'Dead & Zero-Sales Stock', description: 'Products holding cash with no recent sales.', category: 'inventory', status: 'ready' },
  { key: 'stock-aging', title: 'Stock Aging', description: 'How long stock has sat since its last movement.', category: 'inventory', status: 'ready' },
  { key: 'stock-adjustments', title: 'Stock Adjustments', description: 'Manual stock corrections audit trail.', category: 'inventory', status: 'ready' },
  { key: 'products', title: 'Products Report', description: 'Full catalog with stock, value and status.', category: 'inventory', status: 'ready' },
  // Customers
  { key: 'top-customers', title: 'Top Customers', description: 'Your most valuable customers by spend and orders.', category: 'customers', status: 'ready' },
  { key: 'inactive-customers', title: 'Inactive Customers', description: 'Customers who have not ordered recently — win them back.', category: 'customers', status: 'ready' },
  // Requires features not yet in the system (honest placeholders)
  { key: 'warranty', title: 'Warranty / Guarantee', description: 'Needs a warranty tracking feature.', category: 'sales', status: 'soon', soonReason: 'No warranty data model yet' },
  { key: 'service-jobs', title: 'Service Jobs', description: 'Needs a service/repair jobs feature.', category: 'sales', status: 'soon', soonReason: 'No service-jobs module yet' },
  { key: 'warehouses', title: 'Warehouses & Locations', description: 'Needs multi-warehouse inventory.', category: 'inventory', status: 'soon', soonReason: 'Single-location inventory only' },
  { key: 'stock-transfer', title: 'Stock Transfers', description: 'Needs multi-location stock transfers.', category: 'inventory', status: 'soon', soonReason: 'No warehouses to transfer between' },
  { key: 'expiry', title: 'Expiry & Batches', description: 'Needs batch/expiry tracking on products.', category: 'inventory', status: 'soon', soonReason: 'No batch/expiry fields' },
  { key: 'loyalty', title: 'Loyalty Points', description: 'Needs a loyalty points program.', category: 'customers', status: 'soon', soonReason: 'No loyalty module yet' },
  { key: 'attendance', title: 'Attendance', description: 'Needs staff/attendance tracking.', category: 'finance', status: 'soon', soonReason: 'No staff module yet' },
  { key: 'login-activity', title: 'Login Activity', description: 'Needs session/audit logging.', category: 'finance', status: 'soon', soonReason: 'No login audit yet' },
];

// ---------------------------------------------------------------------------
// FINANCE
// ---------------------------------------------------------------------------
export interface ProfitLossReport {
  period: ReportPeriod;
  revenue: number; // sales + delivered orders (net of returns)
  cogs: number; // cost of goods sold
  grossProfit: number;
  grossMarginPct: number | null;
  expenses: number; // caisse expenses + product expenses in period
  deliveryCosts: number; // delivery fees on delivered orders
  netProfit: number;
  netMarginPct: number | null;
  breakdown: RankRow[]; // waterfall-ish lines: Revenue, COGS, Gross, Expenses, Delivery, Net
  series: TimePoint[]; // { date,label, revenue, profit }
}
export const getProfitLoss = (period: ReportPeriodParam = 'month', opts?: RangeOpts) =>
  apiRequest<ProfitLossReport>(`/api/user-stock/reports/profit-loss?${q(period, opts)}`);

export interface CashFlowReport {
  period: ReportPeriod;
  totalIn: number;
  totalOut: number;
  net: number;
  openingBalance: number; // lifetime balance before the window
  closingBalance: number;
  series: TimePoint[]; // { date,label, in, out, balance }
  byCategory: RankRow[]; // expense/income categories
}
export const getCashFlow = (period: ReportPeriodParam = 'month', opts?: RangeOpts) =>
  apiRequest<CashFlowReport>(`/api/user-stock/reports/cash-flow?${q(period, opts)}`);

export interface CashRegisterRow {
  id: string;
  date: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  reference: string | null;
  description: string | null;
  isAutomatic: boolean;
}
export interface CashRegisterReport {
  period: ReportPeriod;
  income: number;
  expense: number;
  balance: number;
  count: number;
  rows: CashRegisterRow[];
}
export const getCashRegister = (period: ReportPeriodParam = 'month', opts?: RangeOpts) =>
  apiRequest<CashRegisterReport>(`/api/user-stock/reports/cash-register?${q(period, opts)}`);

export interface PaymentsReport {
  period: ReportPeriod;
  received: number; // sales + orders amountPaid
  paidOut: number; // purchases amountPaid
  net: number;
  byMethod: RankRow[]; // cash/card/transfer/ccp
  bySource: RankRow[]; // Sales / Orders / Purchases
  series: TimePoint[]; // { date,label, received, paidOut }
}
export const getPayments = (period: ReportPeriodParam = 'month', opts?: RangeOpts) =>
  apiRequest<PaymentsReport>(`/api/user-stock/reports/payments?${q(period, opts)}`);

export interface ExpensesReport {
  period: ReportPeriod;
  total: number;
  byCategory: RankRow[];
  series: TimePoint[]; // { date,label, amount }
  rows: Array<{ id: string; date: string; category: string; description: string | null; amount: number; source: 'caisse' | 'product' }>;
}
export const getExpenses = (period: ReportPeriodParam = 'month', opts?: RangeOpts) =>
  apiRequest<ExpensesReport>(`/api/user-stock/reports/expenses?${q(period, opts)}`);

export interface TaxSummaryReport {
  period: ReportPeriod;
  taxCollected: number;
  taxableRevenue: number;
  effectiveRatePct: number | null;
  series: TimePoint[]; // { date,label, tax }
  bySource: RankRow[]; // Sales tax / Orders tax
}
export const getTaxSummary = (period: ReportPeriodParam = 'month', opts?: RangeOpts) =>
  apiRequest<TaxSummaryReport>(`/api/user-stock/reports/tax-summary?${q(period, opts)}`);

export interface DiscountSummaryReport {
  period: ReportPeriod;
  totalDiscount: number;
  discountedRevenue: number;
  discountRatePct: number | null;
  topDiscountedProducts: RankRow[];
  series: TimePoint[]; // { date,label, discount }
}
export const getDiscounts = (period: ReportPeriodParam = 'month', opts?: RangeOpts) =>
  apiRequest<DiscountSummaryReport>(`/api/user-stock/reports/discounts?${q(period, opts)}`);

// ---------------------------------------------------------------------------
// SALES
// ---------------------------------------------------------------------------
export interface SalesReport {
  period: ReportPeriod;
  revenue: number;
  orders: number; // sale receipts + delivered orders count
  avgOrderValue: number | null;
  itemsSold: number;
  series: TimePoint[]; // { date,label, revenue, orders }
  byChannel: RankRow[]; // Walk-in sales / AI orders / Manual orders
  byPaymentStatus: RankRow[];
}
export const getSalesReport = (period: ReportPeriodParam = 'month', opts?: RangeOpts) =>
  apiRequest<SalesReport>(`/api/user-stock/reports/sales?${q(period, opts)}`);

export interface SalesByCategoryReport {
  period: ReportPeriod;
  total: number;
  categories: RankRow[]; // value=revenue, secondary=units
}
export const getSalesByCategory = (period: ReportPeriodParam = 'month', opts?: RangeOpts) =>
  apiRequest<SalesByCategoryReport>(`/api/user-stock/reports/sales-by-category?${q(period, opts)}`);

export interface TopProductsReport {
  period: ReportPeriod;
  products: Array<RankRow & { extra: { units: number; revenue: number; cogs: number; profit: number; marginPct: number } }>;
}
export const getTopProducts = (period: ReportPeriodParam = 'month', opts?: RangeOpts) =>
  apiRequest<TopProductsReport>(`/api/user-stock/reports/top-products?${q(period, opts)}`);

export interface ReturnRatioReport {
  period: ReportPeriod;
  created: number;
  delivered: number;
  cancelled: number;
  returned: number;
  cancelRatePct: number | null;
  returnRatePct: number | null;
  fulfilmentRatePct: number | null;
  lostRevenue: number; // total of cancelled+returned orders
  series: TimePoint[]; // { date,label, delivered, cancelled, returned }
  byWilaya: RankRow[]; // value=returnRatePct, secondary=orders
}
export const getReturnRatio = (period: ReportPeriodParam = 'month', opts?: RangeOpts) =>
  apiRequest<ReturnRatioReport>(`/api/user-stock/reports/return-ratio?${q(period, opts)}`);

// ---------------------------------------------------------------------------
// PURCHASES / SUPPLIERS
// ---------------------------------------------------------------------------
export interface PurchasesReport {
  period: ReportPeriod;
  committed: number; // sum(total) non-cancelled
  paid: number; // sum(amountPaid)
  outstanding: number; // committed - paid
  count: number;
  byStatus: RankRow[];
  series: TimePoint[]; // { date,label, committed, paid }
}
export const getPurchasesReport = (period: ReportPeriodParam = 'month', opts?: RangeOpts) =>
  apiRequest<PurchasesReport>(`/api/user-stock/reports/purchases?${q(period, opts)}`);

export interface ProductPurchasesReport {
  period: ReportPeriod;
  total: number;
  products: RankRow[]; // value=cost, secondary=units
}
export const getProductPurchases = (period: ReportPeriodParam = 'month', opts?: RangeOpts) =>
  apiRequest<ProductPurchasesReport>(`/api/user-stock/reports/product-purchases?${q(period, opts)}`);

export interface SuppliersReport {
  period: ReportPeriod;
  total: number;
  suppliers: Array<RankRow & { extra: { purchases: number; spend: number; outstanding: number } }>;
}
export const getSuppliersReport = (period: ReportPeriodParam = 'month', opts?: RangeOpts) =>
  apiRequest<SuppliersReport>(`/api/user-stock/reports/suppliers?${q(period, opts)}`);
export const getTopSuppliers = (period: ReportPeriodParam = 'month', opts?: RangeOpts) =>
  apiRequest<SuppliersReport>(`/api/user-stock/reports/top-suppliers?${q(period, opts)}`);

// ---------------------------------------------------------------------------
// INVENTORY
// ---------------------------------------------------------------------------
export interface InventoryValuationReport {
  costValue: number; // sum(qty*cost)
  retailValue: number; // sum(qty*sellingPrice)
  potentialProfit: number;
  totalUnits: number;
  productCount: number;
  byCategory: RankRow[]; // value=costValue, secondary=units
  topByValue: RankRow[]; // products by cost value
}
export const getInventoryValuation = () =>
  apiRequest<InventoryValuationReport>(`/api/user-stock/reports/inventory-valuation`);

export interface StockAlertsReport {
  lowStock: Array<{ id: string; name: string; sku: string; quantity: number; minQuantity: number }>;
  negativeStock: Array<{ id: string; name: string; sku: string; quantity: number }>;
  outOfStock: Array<{ id: string; name: string; sku: string; minQuantity: number }>;
  counts: { low: number; negative: number; out: number };
}
export const getStockAlerts = () =>
  apiRequest<StockAlertsReport>(`/api/user-stock/reports/stock-alerts`);

export interface DeadStockReport {
  period: ReportPeriod; // "no sales within" window
  deadStockValue: number;
  items: Array<{ id: string; name: string; sku: string; quantity: number; stockValue: number; lastSoldAt: string | null }>;
  zeroSales: Array<{ id: string; name: string; sku: string; quantity: number }>;
}
export const getDeadStock = (period: ReportPeriodParam = 'month', opts?: RangeOpts) =>
  apiRequest<DeadStockReport>(`/api/user-stock/reports/dead-stock?${q(period, opts)}`);

export interface StockAgingReport {
  buckets: RankRow[]; // label: "0-30d","31-60d","61-90d","90d+"; value=stockValue, secondary=units
  items: Array<{ id: string; name: string; sku: string; quantity: number; stockValue: number; lastMovedAt: string | null; ageDays: number | null }>;
}
export const getStockAging = () =>
  apiRequest<StockAgingReport>(`/api/user-stock/reports/stock-aging`);

export interface StockAdjustmentsReport {
  period: ReportPeriod;
  totalIn: number; // sum of positive adjustment qty
  totalOut: number; // abs sum of negative adjustment qty
  count: number;
  rows: Array<{ id: string; date: string; productName: string; variantName: string | null; quantity: number; reason: string | null }>;
}
export const getStockAdjustments = (period: ReportPeriodParam = 'month', opts?: RangeOpts) =>
  apiRequest<StockAdjustmentsReport>(`/api/user-stock/reports/stock-adjustments?${q(period, opts)}`);

export interface ProductsReport {
  productCount: number;
  activeCount: number;
  totalUnits: number;
  costValue: number;
  retailValue: number;
  rows: Array<{ id: string; name: string; sku: string; category: string | null; quantity: number; costPrice: number; sellingPrice: number; stockValue: number; isActive: boolean; hasVariants: boolean }>;
}
export const getProductsReport = () =>
  apiRequest<ProductsReport>(`/api/user-stock/reports/products`);

// ---------------------------------------------------------------------------
// CUSTOMERS
// ---------------------------------------------------------------------------
export interface TopCustomersReport {
  period: ReportPeriod;
  total: number; // total spent in period (or lifetime for the tiles)
  customers: Array<RankRow & { extra: { orders: number; spent: number; lastOrderDate: string | null; source: string } }>;
}
export const getTopCustomers = (period: ReportPeriodParam = 'month', opts?: RangeOpts) =>
  apiRequest<TopCustomersReport>(`/api/user-stock/reports/top-customers?${q(period, opts)}`);

export interface InactiveCustomersReport {
  thresholdDays: number;
  count: number;
  lostValue: number; // sum of their lifetime totalSpent
  customers: Array<{ id: string; name: string; phone: string | null; totalOrders: number; totalSpent: number; lastOrderDate: string | null; daysSince: number | null }>;
}
export const getInactiveCustomers = (thresholdDays = 60) =>
  apiRequest<InactiveCustomersReport>(`/api/user-stock/reports/inactive-customers?days=${thresholdDays}`);
