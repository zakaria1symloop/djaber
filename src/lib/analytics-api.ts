// ============================================================================
// Deep analytics API client — /api/user-stock/analytics/*
// Contract shared by the backend controller (user-analytics.controller.ts)
// and the /dashboard/analytics tab components. Keep both in sync.
// ============================================================================

import { apiRequest } from './api-config';

export type AnalyticsPeriod = 'today' | 'week' | 'month' | 'year';

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export interface ProductAnalytics {
  id: string;
  name: string;
  sku: string;
  categoryName: string | null;
  unitsSold: number; // order items (non-cancelled/returned) + sale items, in period
  revenue: number;
  cogs: number; // unitsSold × costPrice
  grossProfit: number;
  marginPct: number | null;
  stockQty: number;
  stockValue: number; // stockQty × costPrice
  velocityPerWeek: number;
  stockCoverDays: number | null; // stock left ÷ daily velocity; null when no sales
  lastSoldAt: string | null;
}

export interface CategoryAnalytics {
  name: string;
  revenue: number;
  unitsSold: number;
  productCount: number;
}

export interface DeadStockItem {
  id: string;
  name: string;
  sku: string;
  stockQty: number;
  stockValue: number;
  lastSoldAt: string | null;
}

export interface ProductsAnalyticsResponse {
  period: AnalyticsPeriod;
  totals: { revenue: number; unitsSold: number; grossProfit: number; stockValue: number };
  products: ProductAnalytics[]; // sorted by revenue desc, max 100
  categories: CategoryAnalytics[]; // sorted by revenue desc
  deadStock: DeadStockItem[]; // qty>0, zero sales in period; top 20 by stockValue
}

export function getProductsAnalytics(period: AnalyticsPeriod = 'month'): Promise<ProductsAnalyticsResponse> {
  return apiRequest(`/api/user-stock/analytics/products?period=${period}`);
}

// ---------------------------------------------------------------------------
// Channels (connected pages — "which pages have potential")
// ---------------------------------------------------------------------------

export interface ChannelAnalytics {
  pageId: string; // internal Page.id
  pageName: string;
  platform: string;
  conversations: number; // active in period (with >=1 message in period)
  newConversations: number; // created in period
  messagesIn: number;
  messagesOut: number;
  unread: number;
  aiOrders: number; // attributed via client → latest conversation before order
  aiRevenue: number;
  conversionPct: number | null; // aiOrders / conversations (period)
  potentialScore: number; // 0-100 heuristic
  potentialNote: string; // one-line human explanation of the score
}

export interface ChannelsAnalyticsResponse {
  period: AnalyticsPeriod;
  channels: ChannelAnalytics[]; // sorted by potentialScore desc
}

export function getChannelsAnalytics(period: AnalyticsPeriod = 'month'): Promise<ChannelsAnalyticsResponse> {
  return apiRequest(`/api/user-stock/analytics/channels?period=${period}`);
}

// ---------------------------------------------------------------------------
// Agents ("which AI generates more income")
// ---------------------------------------------------------------------------

export interface AgentAnalytics {
  id: string;
  name: string;
  isActive: boolean;
  aiModel: string;
  conversations: number; // conversations with agentId=this agent, active in period
  messagesHandled: number; // outgoing messages in those conversations, in period
  aiOrders: number;
  aiRevenue: number;
  avgOrderValue: number | null;
  conversionPct: number | null; // aiOrders / conversations
  insights: { unclear: number; unknown: number; handoff: number; resolved: number };
}

export interface AgentsAnalyticsResponse {
  period: AnalyticsPeriod;
  agents: AgentAnalytics[]; // sorted by aiRevenue desc
}

export function getAgentsAnalytics(period: AnalyticsPeriod = 'month'): Promise<AgentsAnalyticsResponse> {
  return apiRequest(`/api/user-stock/analytics/agents?period=${period}`);
}

// ---------------------------------------------------------------------------
// Orders (funnel, COD collection, wilaya, trend)
// ---------------------------------------------------------------------------

export interface OrdersAnalyticsResponse {
  period: AnalyticsPeriod;
  funnel: {
    created: number;
    confirmed: number; // reached confirmed or beyond
    shipped: number; // reached shipped/delivered
    delivered: number;
    cancelled: number;
    returned: number;
  };
  confirmation: {
    notCalled: number;
    noAnswer: number;
    confirmed: number;
    rejected: number;
    avgCallAttempts: number;
  };
  cod: {
    deliveredCount: number;
    deliveredValue: number;
    collectedValue: number; // amountPaid over delivered orders
    collectionPct: number | null;
  };
  cancelRatePct: number | null;
  returnRatePct: number | null;
  bySource: {
    ai: { orders: number; revenue: number };
    manual: { orders: number; revenue: number };
  };
  byWilaya: Array<{
    wilayaId: number;
    name: string; // French name
    orders: number;
    revenue: number;
    delivered: number;
    returned: number;
    deliveryFees: number;
  }>; // top 15 by orders
  series: Array<{ date: string; orders: number; revenue: number }>; // daily buckets
}

export function getOrdersAnalytics(period: AnalyticsPeriod = 'month'): Promise<OrdersAnalyticsResponse> {
  return apiRequest(`/api/user-stock/analytics/orders?period=${period}`);
}
