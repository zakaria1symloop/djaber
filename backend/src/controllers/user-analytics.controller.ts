import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { getWilayaById } from '../data/wilayas';
import { resolveWindow, WindowDateFilter } from '../utils/period';

// ============================================================================
// Deep Analytics — products / channels / agents / orders
// Response shapes MUST match the frontend contract in src/lib/analytics-api.ts
// ============================================================================

// Order statuses excluded from revenue attribution everywhere
const EXCLUDED_ORDER_STATUSES = ['cancelled', 'returned'];

// ============================================================================
// Products
// ============================================================================

export const getProductsAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const userId = req.user.userId;
    const { period, days, dateFilter } = resolveWindow(
      req.query.period,
      req.query.startDate,
      req.query.endDate
    );

    const [allProducts, orderAgg, saleAgg] = await Promise.all([
      prisma.product.findMany({
        where: { userId, isActive: true },
        select: {
          id: true,
          name: true,
          sku: true,
          quantity: true,
          costPrice: true,
          category: { select: { name: true } },
        },
      }),
      // Units + revenue from customer orders (non-cancelled/returned) in window
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          order: {
            userId,
            orderDate: dateFilter,
            status: { notIn: EXCLUDED_ORDER_STATUSES },
          },
        },
        _sum: { quantity: true, total: true },
      }),
      // Units + revenue from walk-in sales in window
      prisma.saleItem.groupBy({
        by: ['productId'],
        where: { sale: { userId, saleDate: dateFilter } },
        _sum: { quantity: true, total: true },
      }),
    ]);

    // Merge order + sale aggregates into one map (batch join, no N+1)
    const salesByProduct = new Map<string, { units: number; revenue: number }>();
    for (const row of [...orderAgg, ...saleAgg]) {
      const prev = salesByProduct.get(row.productId) || { units: 0, revenue: 0 };
      prev.units += Number(row._sum.quantity ?? 0);
      prev.revenue += Number(row._sum.total ?? 0);
      salesByProduct.set(row.productId, prev);
    }

    // Build per-product analytics (totals are computed over ALL active
    // products, before the top-100 cap is applied)
    const totals = { revenue: 0, unitsSold: 0, grossProfit: 0, stockValue: 0 };
    const categoryMap = new Map<string, { revenue: number; unitsSold: number; productCount: number }>();

    const enriched = allProducts.map((p) => {
      const sold = salesByProduct.get(p.id) || { units: 0, revenue: 0 };
      const costPrice = Number(p.costPrice) || 0;
      const unitsSold = sold.units;
      const revenue = sold.revenue;
      const cogs = unitsSold * costPrice;
      const grossProfit = revenue - cogs;
      const stockValue = p.quantity * costPrice;

      totals.revenue += revenue;
      totals.unitsSold += unitsSold;
      totals.grossProfit += grossProfit;
      totals.stockValue += stockValue;

      const categoryName = p.category?.name ?? null;
      const catKey = categoryName ?? 'Uncategorized';
      const cat = categoryMap.get(catKey) || { revenue: 0, unitsSold: 0, productCount: 0 };
      cat.revenue += revenue;
      cat.unitsSold += unitsSold;
      cat.productCount += 1;
      categoryMap.set(catKey, cat);

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        categoryName,
        unitsSold,
        revenue,
        cogs,
        grossProfit,
        marginPct: revenue > 0 ? (grossProfit / revenue) * 100 : null,
        stockQty: p.quantity,
        stockValue,
        velocityPerWeek: unitsSold / (days / 7),
        stockCoverDays: unitsSold > 0 ? p.quantity / (unitsSold / days) : null,
        lastSoldAt: null as string | null, // filled below in one batch
      };
    });

    // products array: sold in period OR still in stock; top 100 by revenue
    const products = enriched
      .filter((p) => p.unitsSold > 0 || p.stockQty > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 100);

    // deadStock: in stock but zero sales in the window; top 20 by stock value
    const deadStock = enriched
      .filter((p) => p.stockQty > 0 && p.unitsSold === 0)
      .sort((a, b) => b.stockValue - a.stockValue)
      .slice(0, 20);

    // lastSoldAt (latest order/sale date EVER) for the products we return.
    // Single raw query instead of 2 findFirst calls per product.
    const idsNeedingLastSold = [...new Set([...products, ...deadStock].map((p) => p.id))];
    const lastSoldMap = new Map<string, string>();
    if (idsNeedingLastSold.length > 0) {
      const rows = await prisma.$queryRaw<Array<{ productId: string; lastDate: Date | string | null }>>(Prisma.sql`
        SELECT productId, MAX(d) as lastDate FROM (
          SELECT oi.productId AS productId, o.orderDate AS d
          FROM OrderItem oi
          INNER JOIN \`Order\` o ON o.id = oi.orderId
          WHERE o.userId = ${userId} AND oi.productId IN (${Prisma.join(idsNeedingLastSold)})
          UNION ALL
          SELECT si.productId AS productId, s.saleDate AS d
          FROM SaleItem si
          INNER JOIN Sale s ON s.id = si.saleId
          WHERE s.userId = ${userId} AND si.productId IN (${Prisma.join(idsNeedingLastSold)})
        ) t
        GROUP BY productId
      `);
      for (const row of rows) {
        if (row.lastDate) lastSoldMap.set(row.productId, new Date(row.lastDate).toISOString());
      }
    }
    for (const p of products) p.lastSoldAt = lastSoldMap.get(p.id) ?? null;

    const categories = [...categoryMap.entries()]
      .map(([name, c]) => ({ name, revenue: c.revenue, unitsSold: c.unitsSold, productCount: c.productCount }))
      .sort((a, b) => b.revenue - a.revenue);

    res.json({
      period,
      totals,
      products,
      categories,
      deadStock: deadStock.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        stockQty: p.stockQty,
        stockValue: p.stockValue,
        lastSoldAt: lastSoldMap.get(p.id) ?? null,
      })),
    });
  } catch (error) {
    console.error('Get products analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch products analytics' });
  }
};

// ============================================================================
// AI-order attribution (shared by channels + agents)
// ============================================================================

interface AttributionData {
  orders: Array<{ clientId: string | null; total: Prisma.Decimal; createdAt: Date }>;
  conversationsByClient: Map<string, Array<{ pageId: string; agentId: string | null; updatedAt: Date }>>;
}

// Fetch AI orders in the window plus each ordering client's conversations
// (newest first) so callers can attribute every order to the conversation
// that most plausibly produced it.
const fetchAiOrderAttribution = async (
  userId: string,
  dateFilter: WindowDateFilter
): Promise<AttributionData> => {
  const orders = await prisma.order.findMany({
    where: {
      userId,
      source: 'ai',
      orderDate: dateFilter,
      status: { notIn: EXCLUDED_ORDER_STATUSES },
      clientId: { not: null },
    },
    select: { clientId: true, total: true, createdAt: true },
  });

  const clientIds = [...new Set(orders.map((o) => o.clientId as string))];
  const conversations = clientIds.length
    ? await prisma.conversation.findMany({
        where: { userId, clientId: { in: clientIds } },
        select: { clientId: true, pageId: true, agentId: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      })
    : [];

  const conversationsByClient = new Map<string, Array<{ pageId: string; agentId: string | null; updatedAt: Date }>>();
  for (const c of conversations) {
    if (!c.clientId) continue;
    const list = conversationsByClient.get(c.clientId) || [];
    list.push({ pageId: c.pageId, agentId: c.agentId, updatedAt: c.updatedAt });
    conversationsByClient.set(c.clientId, list);
  }

  return { orders, conversationsByClient };
};

// ============================================================================
// Channels (connected pages)
// ============================================================================

export const getChannelsAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const userId = req.user.userId;
    const { period, dateFilter } = resolveWindow(
      req.query.period,
      req.query.startDate,
      req.query.endDate
    );

    const [pages, attribution] = await Promise.all([
      prisma.page.findMany({
        where: { userId, isActive: true },
        select: { id: true, pageName: true, platform: true },
      }),
      fetchAiOrderAttribution(userId, dateFilter),
    ]);

    // Attribute each AI order to the page of the client's most recent
    // conversation that predates the order (fallback: most recent overall).
    const ordersByPage = new Map<string, { count: number; revenue: number }>();
    for (const order of attribution.orders) {
      const convs = attribution.conversationsByClient.get(order.clientId as string) || [];
      const match = convs.find((c) => c.updatedAt <= order.createdAt) ?? convs[0];
      if (!match) continue;
      const prev = ordersByPage.get(match.pageId) || { count: 0, revenue: 0 };
      prev.count += 1;
      prev.revenue += Number(order.total) || 0;
      ordersByPage.set(match.pageId, prev);
    }

    const channels = await Promise.all(
      pages.map(async (page) => {
        const [conversations, newConversations, messagesIn, messagesOut, activeConversations] = await Promise.all([
          prisma.conversation.count({
            where: { pageId: page.id, messages: { some: { timestamp: dateFilter } } },
          }),
          prisma.conversation.count({ where: { pageId: page.id, createdAt: dateFilter } }),
          prisma.message.count({
            where: { conversation: { pageId: page.id }, timestamp: dateFilter, isFromPage: false },
          }),
          prisma.message.count({
            where: { conversation: { pageId: page.id }, timestamp: dateFilter, isFromPage: true },
          }),
          // Unread = active conversations whose latest message is from the
          // customer (same technique as page-summary.service)
          prisma.conversation.findMany({
            where: { pageId: page.id, status: 'active' },
            select: {
              messages: { orderBy: { timestamp: 'desc' }, take: 1, select: { isFromPage: true } },
            },
          }),
        ]);

        const unread = activeConversations.filter((c) => c.messages[0] && !c.messages[0].isFromPage).length;
        const attributed = ordersByPage.get(page.id) || { count: 0, revenue: 0 };
        const aiOrders = attributed.count;
        const aiRevenue = attributed.revenue;
        const conversionPct = conversations > 0 ? (aiOrders / conversations) * 100 : null;

        // Potential score (0-100): traffic volume + engagement + conversion gap
        const volume = Math.min(40, conversations * 2);
        const engagement = Math.min(30, messagesIn / 10);
        const conversionGap =
          conversations >= 5 && (conversionPct ?? 0) < 10 ? 30 : conversations >= 5 ? 10 : 0;
        const potentialScore = Math.round(volume + engagement + conversionGap);

        let potentialNote: string;
        if (conversations >= 5 && (conversionPct ?? 0) < 10) {
          potentialNote = 'High traffic but low conversion — tune the agent or catalog';
        } else if (conversations >= 5) {
          potentialNote = 'Converting well — scale this page';
        } else {
          potentialNote = 'Low traffic — promote this page';
        }

        return {
          pageId: page.id,
          pageName: page.pageName,
          platform: page.platform,
          conversations,
          newConversations,
          messagesIn,
          messagesOut,
          unread,
          aiOrders,
          aiRevenue,
          conversionPct,
          potentialScore,
          potentialNote,
        };
      })
    );

    channels.sort((a, b) => b.potentialScore - a.potentialScore);

    res.json({ period, channels });
  } catch (error) {
    console.error('Get channels analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch channels analytics' });
  }
};

// ============================================================================
// Agents
// ============================================================================

export const getAgentsAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const userId = req.user.userId;
    const { period, dateFilter } = resolveWindow(
      req.query.period,
      req.query.startDate,
      req.query.endDate
    );

    const [agents, attribution] = await Promise.all([
      prisma.agent.findMany({
        where: { userId },
        select: { id: true, name: true, isActive: true, aiModel: true },
      }),
      fetchAiOrderAttribution(userId, dateFilter),
    ]);

    // Attribute each AI order to the agent of the client's most recent
    // agent-handled conversation predating the order (fallback: most recent
    // agent-handled conversation overall).
    const ordersByAgent = new Map<string, { count: number; revenue: number }>();
    for (const order of attribution.orders) {
      const convs = (attribution.conversationsByClient.get(order.clientId as string) || []).filter(
        (c) => c.agentId
      );
      const match = convs.find((c) => c.updatedAt <= order.createdAt) ?? convs[0];
      if (!match || !match.agentId) continue;
      const prev = ordersByAgent.get(match.agentId) || { count: 0, revenue: 0 };
      prev.count += 1;
      prev.revenue += Number(order.total) || 0;
      ordersByAgent.set(match.agentId, prev);
    }

    // Insight counters in one grouped query for all agents
    const agentIds = agents.map((a) => a.id);
    const insightRows = agentIds.length
      ? await prisma.agentInsight.groupBy({
          by: ['agentId', 'type', 'status'],
          where: { agentId: { in: agentIds }, createdAt: dateFilter },
          _count: { _all: true },
        })
      : [];

    const insightsByAgent = new Map<string, { unclear: number; unknown: number; handoff: number; resolved: number }>();
    for (const row of insightRows) {
      const bucket =
        insightsByAgent.get(row.agentId) || { unclear: 0, unknown: 0, handoff: 0, resolved: 0 };
      const n = row._count._all;
      if (row.status === 'resolved') bucket.resolved += n;
      // Type counters include pending + resolved (dismissed excluded)
      if (row.status === 'pending' || row.status === 'resolved') {
        if (row.type === 'unclear') bucket.unclear += n;
        else if (row.type === 'unknown_topic') bucket.unknown += n;
        else if (row.type === 'handoff') bucket.handoff += n;
      }
      insightsByAgent.set(row.agentId, bucket);
    }

    const result = await Promise.all(
      agents.map(async (agent) => {
        const [conversations, messagesHandled] = await Promise.all([
          prisma.conversation.count({
            where: { agentId: agent.id, messages: { some: { timestamp: dateFilter } } },
          }),
          prisma.message.count({
            where: { conversation: { agentId: agent.id }, timestamp: dateFilter, isFromPage: true },
          }),
        ]);

        const attributed = ordersByAgent.get(agent.id) || { count: 0, revenue: 0 };
        const aiOrders = attributed.count;
        const aiRevenue = attributed.revenue;

        return {
          id: agent.id,
          name: agent.name,
          isActive: agent.isActive,
          aiModel: agent.aiModel,
          conversations,
          messagesHandled,
          aiOrders,
          aiRevenue,
          avgOrderValue: aiOrders > 0 ? aiRevenue / aiOrders : null,
          conversionPct: conversations > 0 ? (aiOrders / conversations) * 100 : null,
          insights: insightsByAgent.get(agent.id) || { unclear: 0, unknown: 0, handoff: 0, resolved: 0 },
        };
      })
    );

    result.sort((a, b) => b.aiRevenue - a.aiRevenue);

    res.json({ period, agents: result });
  } catch (error) {
    console.error('Get agents analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch agents analytics' });
  }
};

// ============================================================================
// Orders
// ============================================================================

const pad2 = (n: number): string => String(n).padStart(2, '0');
const dayKey = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const monthKey = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;

export const getOrdersAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const userId = req.user.userId;
    const { period, start, end, bucket, dateFilter } = resolveWindow(
      req.query.period,
      req.query.startDate,
      req.query.endDate
    );

    const orders = await prisma.order.findMany({
      where: { userId, orderDate: dateFilter },
      select: {
        status: true,
        confirmationStatus: true,
        callAttempts: true,
        total: true,
        amountPaid: true,
        deliveryFee: true,
        source: true,
        wilayaId: true,
        orderDate: true,
      },
    });

    // ---- Funnel -------------------------------------------------------
    const created = orders.length;
    const CONFIRMED_OR_BEYOND = ['confirmed', 'preparing', 'shipped', 'delivered'];
    const SHIPPED_OR_BEYOND = ['shipped', 'delivered'];
    const funnel = {
      created,
      confirmed: orders.filter((o) => CONFIRMED_OR_BEYOND.includes(o.status)).length,
      shipped: orders.filter((o) => SHIPPED_OR_BEYOND.includes(o.status)).length,
      delivered: orders.filter((o) => o.status === 'delivered').length,
      cancelled: orders.filter((o) => o.status === 'cancelled').length,
      returned: orders.filter((o) => o.status === 'returned').length,
    };

    // ---- Call confirmation --------------------------------------------
    const totalCallAttempts = orders.reduce((sum, o) => sum + o.callAttempts, 0);
    const confirmation = {
      notCalled: orders.filter((o) => o.confirmationStatus === 'not_called').length,
      noAnswer: orders.filter((o) => o.confirmationStatus === 'no_answer').length,
      confirmed: orders.filter((o) => o.confirmationStatus === 'confirmed').length,
      rejected: orders.filter((o) => o.confirmationStatus === 'rejected').length,
      avgCallAttempts: created > 0 ? totalCallAttempts / created : 0,
    };

    // ---- COD collection -------------------------------------------------
    const deliveredOrders = orders.filter((o) => o.status === 'delivered');
    const deliveredValue = deliveredOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const collectedValue = deliveredOrders.reduce((sum, o) => sum + (Number(o.amountPaid) || 0), 0);
    const cod = {
      deliveredCount: deliveredOrders.length,
      deliveredValue,
      collectedValue,
      collectionPct: deliveredValue > 0 ? (collectedValue / deliveredValue) * 100 : null,
    };

    // ---- Source split (revenue excludes cancelled/returned) -------------
    const bySource = {
      ai: { orders: 0, revenue: 0 },
      manual: { orders: 0, revenue: 0 },
    };
    for (const o of orders) {
      const bucket = o.source === 'ai' ? bySource.ai : bySource.manual;
      bucket.orders += 1;
      if (!EXCLUDED_ORDER_STATUSES.includes(o.status)) bucket.revenue += Number(o.total) || 0;
    }

    // ---- Wilaya breakdown ------------------------------------------------
    const wilayaMap = new Map<
      number,
      { orders: number; revenue: number; delivered: number; returned: number; deliveryFees: number }
    >();
    for (const o of orders) {
      if (o.wilayaId == null) continue;
      const w =
        wilayaMap.get(o.wilayaId) || { orders: 0, revenue: 0, delivered: 0, returned: 0, deliveryFees: 0 };
      w.orders += 1;
      // Revenue excludes cancelled/returned (same rule as bySource)
      if (!EXCLUDED_ORDER_STATUSES.includes(o.status)) w.revenue += Number(o.total) || 0;
      if (o.status === 'delivered') w.delivered += 1;
      if (o.status === 'returned') w.returned += 1;
      // deliveryFee stays 0 until the order is sent to a delivery provider
      w.deliveryFees += Number(o.deliveryFee) || 0;
      wilayaMap.set(o.wilayaId, w);
    }
    const byWilaya = [...wilayaMap.entries()]
      .map(([wilayaId, w]) => ({
        wilayaId,
        name: getWilayaById(wilayaId)?.nameFr ?? `Wilaya ${wilayaId}`,
        orders: w.orders,
        revenue: w.revenue,
        delivered: w.delivered,
        returned: w.returned,
        deliveryFees: w.deliveryFees,
      }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 15);

    // ---- Time series (daily buckets; monthly for wide windows) -----------
    const isMonthly = bucket === 'month';
    const seriesMap = new Map<string, { orders: number; revenue: number }>();
    const cursor = isMonthly
      ? new Date(start.getFullYear(), start.getMonth(), 1)
      : new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const seriesEnd = isMonthly
      ? new Date(end.getFullYear(), end.getMonth(), 1)
      : new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (cursor <= seriesEnd) {
      seriesMap.set(isMonthly ? monthKey(cursor) : dayKey(cursor), { orders: 0, revenue: 0 });
      if (isMonthly) cursor.setMonth(cursor.getMonth() + 1);
      else cursor.setDate(cursor.getDate() + 1);
    }
    for (const o of orders) {
      const key = isMonthly ? monthKey(o.orderDate) : dayKey(o.orderDate);
      const bucket = seriesMap.get(key);
      if (!bucket) continue;
      bucket.orders += 1;
      // Revenue excludes cancelled/returned (same rule as bySource)
      if (!EXCLUDED_ORDER_STATUSES.includes(o.status)) bucket.revenue += Number(o.total) || 0;
    }
    const series = [...seriesMap.entries()].map(([date, v]) => ({
      date,
      orders: v.orders,
      revenue: v.revenue,
    }));

    res.json({
      period,
      funnel,
      confirmation,
      cod,
      cancelRatePct: created > 0 ? (funnel.cancelled / created) * 100 : null,
      returnRatePct: created > 0 ? (funnel.returned / created) * 100 : null,
      bySource,
      byWilaya,
      series,
    });
  } catch (error) {
    console.error('Get orders analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch orders analytics' });
  }
};
