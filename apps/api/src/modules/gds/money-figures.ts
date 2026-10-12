// 04 §4 named figures used by the GDS KPIs (and by the M8 reports): Revenue = Σ completed sales + Σ delivered orders;
// P&L = Revenue − COGS − expenses, where expenses = manual cash expenses + product expenses + return costs and
// purchases are NOT subtracted again (V1 fix, AT-ORD-11): the cost of what was sold is already in COGS.

export type PnlInput = {
  /** Σ completed sales (soldAt in period) */
  salesRevenue: number;
  /** Σ delivered orders (deliveredAt in period) */
  ordersRevenue: number;
  /** Σ lines × cost price snapshot (variant cost when variant) of those sales and orders */
  cogs: number;
  /** manual cash expense rows of the period (rent, salary, utilities, marketing, shipping, other) */
  manualExpenses: number;
  /** product expenses of the period (GDS-09) */
  productExpenses: number;
  /** courier return fees (D27, automatic `shipping` expense rows of returned orders) */
  returnCosts: number;
  /** purchases paid in the period (cash `purchase` rows) — shown for information, never subtracted */
  purchasesPaid: number;
};
export type Pnl = { revenue: number; cogs: number; grossMargin: number; expenses: number; net: number; purchasesPaid: number };

export const profitAndLoss = (i: PnlInput): Pnl => {
  const revenue = i.salesRevenue + i.ordersRevenue;
  const expenses = i.manualExpenses + i.productExpenses + i.returnCosts;
  const grossMargin = revenue - i.cogs;
  return { revenue, cogs: i.cogs, grossMargin, expenses, net: grossMargin - expenses, purchasesPaid: i.purchasesPaid };
};

/** COGS of document lines: quantity × cost snapshot (a line without a cost counts 0). */
export const cogsOf = (lines: { quantity: number; costPrice: number | null }[]) => lines.reduce((s, l) => s + l.quantity * (l.costPrice ?? 0), 0);
