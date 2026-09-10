import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { fail, handleError } from '../errors';
import { Validator, pagination } from '../middleware/validate';

const USER_PLANS = ['individual', 'teams'] as const;
const BILLING_CYCLES = ['monthly', 'yearly'] as const;
const SUBSCRIPTION_STATUSES = ['active', 'cancelled', 'expired', 'trial'] as const;
const CMS_CATEGORIES = ['company', 'legal'] as const;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CURRENCY_RE = /^[A-Za-z]{2,5}$/;

/** Optional array of non-empty strings (features list). Returns null when absent. */
const featureList = (v: Validator, value: unknown, field: string): string[] | null => {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.some((f) => typeof f !== 'string' || f.trim() === '')) {
    v.add(field, 'FIELD_INVALID');
    return null;
  }
  return (value as string[]).map((f) => f.trim());
};

/** Optional boolean that must be an actual boolean when present. */
const optionalBool = (v: Validator, value: unknown, field: string): boolean | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') {
    v.add(field, 'FIELD_INVALID');
    return undefined;
  }
  return value;
};

/**
 * Returns platform-wide analytics for super admins.
 * Aggregates data across ALL users.
 */
export const getAdminAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { period = 'month' } = req.query;

    const now = new Date();
    let startDate: Date;
    switch (period) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1));
    }

    const [
      totalUsers,
      newUsersInPeriod,
      adminCount,
      totalPages,
      pagesByPlatform,
      totalProducts,
      totalSales,
      totalRevenue,
      totalPurchases,
      totalSpent,
      activeAgents,
      totalConversations,
      messagesInPeriod,
      planBreakdown,
      recentSignups,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: startDate } } }),
      prisma.user.count({ where: { isAdmin: true } }),
      prisma.page.count({ where: { isActive: true } }),
      prisma.page.groupBy({
        by: ['platform'],
        where: { isActive: true },
        _count: { _all: true },
      }),
      prisma.product.count(),
      prisma.sale.count({ where: { saleDate: { gte: startDate } } }),
      prisma.sale.aggregate({
        where: { saleDate: { gte: startDate } },
        _sum: { total: true },
      }),
      prisma.purchase.count({ where: { purchaseDate: { gte: startDate } } }),
      prisma.purchase.aggregate({
        where: { purchaseDate: { gte: startDate } },
        _sum: { total: true },
      }),
      prisma.agent.count({ where: { isActive: true } }),
      prisma.conversation.count(),
      prisma.message.count({ where: { createdAt: { gte: startDate } } }),
      prisma.user.groupBy({
        by: ['plan'],
        _count: { _all: true },
      }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          plan: true,
          createdAt: true,
        },
      }),
    ]);

    res.json({
      period,
      stats: {
        totalUsers,
        newUsersInPeriod,
        adminCount,
        totalPages,
        totalProducts,
        totalSales,
        totalRevenue: Number(totalRevenue._sum.total || 0),
        totalPurchases,
        totalSpent: Number(totalSpent._sum.total || 0),
        activeAgents,
        totalConversations,
        messagesInPeriod,
      },
      pagesByPlatform: pagesByPlatform.map(p => ({
        platform: p.platform,
        count: p._count._all,
      })),
      planBreakdown: planBreakdown.map(p => ({
        plan: p.plan,
        count: p._count._all,
      })),
      recentSignups,
    });
  } catch (error) {
    return handleError(req, res, error, 'ADMIN_ANALYTICS_FAILED');
  }
};

// ============================================================================
// Users management
// ============================================================================

export const listUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const search = String(req.query.search || '').trim();
    const plan = String(req.query.plan || '').trim();
    const role = String(req.query.role || '').trim(); // 'admin' | 'user'
    const startDate = String(req.query.startDate || '').trim();
    const endDate = String(req.query.endDate || '').trim();
    const sortBy = String(req.query.sortBy || 'createdAt').trim();
    const sortOrder = (String(req.query.sortOrder || 'desc').trim() === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';
    const { limit, offset } = pagination(req.query, { limit: 50, maxLimit: 500 });

    const where: Record<string, unknown> = {};
    if (plan) where.plan = plan;
    if (role === 'admin') where.isAdmin = true;
    if (role === 'user') where.isAdmin = false;
    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.createdAt = dateFilter;
    }
    if (search) {
      where.OR = [
        { email: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
      ];
    }

    const allowedSort: Record<string, true> = {
      createdAt: true, email: true, firstName: true, lastName: true, plan: true,
    };
    const orderBy: Record<string, 'asc' | 'desc'> = allowedSort[sortBy]
      ? { [sortBy]: sortOrder }
      : { createdAt: 'desc' };

    const [usersBase, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          plan: true,
          isAdmin: true,
          createdAt: true,
          _count: {
            select: {
              pages: true,
              agents: true,
              conversations: true,
            },
          },
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where }),
    ]);

    // Fetch counts that aren't direct Prisma relations on User in parallel.
    // (Product/Sale/Order/Client are linked via userId String fields, not relations.)
    const userIds = usersBase.map((u) => u.id);
    const [productGroups, saleGroups, orderGroups, clientGroups] = await Promise.all([
      prisma.product.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _count: { _all: true },
      }),
      prisma.sale.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _count: { _all: true },
        _sum: { total: true },
      }),
      prisma.order.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _count: { _all: true },
      }),
      prisma.client.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _count: { _all: true },
      }),
    ]);

    const productMap = new Map(productGroups.map((g) => [g.userId, g._count._all]));
    const saleMap = new Map(saleGroups.map((g) => [g.userId, { count: g._count._all, total: Number(g._sum.total || 0) }]));
    const orderMap = new Map(orderGroups.map((g) => [g.userId, g._count._all]));
    const clientMap = new Map(clientGroups.map((g) => [g.userId, g._count._all]));

    let users = usersBase.map((u) => ({
      ...u,
      _counts: {
        pages: u._count.pages,
        agents: u._count.agents,
        conversations: u._count.conversations,
        products: productMap.get(u.id) || 0,
        sales: saleMap.get(u.id)?.count || 0,
        orders: orderMap.get(u.id) || 0,
        clients: clientMap.get(u.id) || 0,
      },
      _revenue: saleMap.get(u.id)?.total || 0,
    }));

    // Post-filter on derived counts (Prisma can't filter aggregations on a String FK)
    const minPages = req.query.minPages ? Number(req.query.minPages) : undefined;
    const maxPages = req.query.maxPages ? Number(req.query.maxPages) : undefined;
    const minProducts = req.query.minProducts ? Number(req.query.minProducts) : undefined;
    const maxProducts = req.query.maxProducts ? Number(req.query.maxProducts) : undefined;
    const minRevenue = req.query.minRevenue ? Number(req.query.minRevenue) : undefined;
    const maxRevenue = req.query.maxRevenue ? Number(req.query.maxRevenue) : undefined;
    const minConvs = req.query.minConversations ? Number(req.query.minConversations) : undefined;
    const activityFilter = String(req.query.activity || '').trim(); // 'with-pages' | 'with-agents' | 'inactive'

    if (minPages !== undefined) users = users.filter((u) => u._counts.pages >= minPages);
    if (maxPages !== undefined) users = users.filter((u) => u._counts.pages <= maxPages);
    if (minProducts !== undefined) users = users.filter((u) => u._counts.products >= minProducts);
    if (maxProducts !== undefined) users = users.filter((u) => u._counts.products <= maxProducts);
    if (minRevenue !== undefined) users = users.filter((u) => u._revenue >= minRevenue);
    if (maxRevenue !== undefined) users = users.filter((u) => u._revenue <= maxRevenue);
    if (minConvs !== undefined) users = users.filter((u) => u._counts.conversations >= minConvs);
    if (activityFilter === 'with-pages') users = users.filter((u) => u._counts.pages > 0);
    if (activityFilter === 'with-agents') users = users.filter((u) => u._counts.agents > 0);
    if (activityFilter === 'inactive') {
      users = users.filter((u) => u._counts.pages === 0 && u._counts.agents === 0 && u._counts.conversations === 0);
    }

    res.json({ users, total: users.length === usersBase.length ? total : users.length });
  } catch (error) {
    return handleError(req, res, error, 'ADMIN_USERS_LIST_FAILED');
  }
};

// ============================================================================
// User details (single user with full data)
// ============================================================================

export const getUserDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String(req.params.userId);

    const [user, pages, agents, productCount, saleAgg, purchaseAgg, orderCount, clientCount, messageCount, conversationCount, conversations] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            plan: true,
            isAdmin: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.page.findMany({
          where: { userId },
          select: {
            id: true,
            pageName: true,
            platform: true,
            isActive: true,
            createdAt: true,
            _count: { select: { conversations: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.agent.findMany({
          where: { userId },
          select: {
            id: true,
            name: true,
            personality: true,
            aiModel: true,
            isActive: true,
            createdAt: true,
            _count: { select: { pages: true, products: true, conversations: true } },
          },
        }),
        prisma.product.count({ where: { userId } }),
        prisma.sale.aggregate({
          where: { userId },
          _count: { _all: true },
          _sum: { total: true },
        }),
        prisma.purchase.aggregate({
          where: { userId },
          _count: { _all: true },
          _sum: { total: true },
        }),
        prisma.order.count({ where: { userId } }),
        prisma.client.count({ where: { userId } }),
        prisma.message.count({
          where: { conversation: { userId } },
        }),
        prisma.conversation.count({ where: { userId } }),
        prisma.conversation.findMany({
          where: { userId },
          take: 10,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            senderName: true,
            platform: true,
            status: true,
            updatedAt: true,
            page: { select: { pageName: true } },
            _count: { select: { messages: true } },
          },
        }),
      ]);

    if (!user) return fail(req, res, 'USER_NOT_FOUND');

    res.json({
      user,
      pages,
      agents,
      stats: {
        products: productCount,
        sales: saleAgg._count._all,
        revenue: Number(saleAgg._sum.total || 0),
        purchases: purchaseAgg._count._all,
        spent: Number(purchaseAgg._sum.total || 0),
        orders: orderCount,
        clients: clientCount,
        conversations: conversationCount,
        messages: messageCount,
      },
      recentConversations: conversations,
    });
  } catch (error) {
    return handleError(req, res, error, 'ADMIN_USER_FETCH_FAILED');
  }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String(req.params.userId);
    const body = (req.body ?? {}) as Record<string, unknown>;

    const v = new Validator();
    const isAdmin = optionalBool(v, body.isAdmin, 'isAdmin');
    const plan = body.plan === undefined || body.plan === null ? undefined : v.oneOf(body.plan, 'plan', USER_PLANS);
    const firstName = v.optionalString(body.firstName, 'firstName', { max: 100 });
    const lastName = v.optionalString(body.lastName, 'lastName', { max: 100 });
    const password = body.password === undefined || body.password === null || body.password === '' ? null : v.requiredString(body.password, 'password', { min: 8, max: 128 });
    v.throwIfAny();

    // Don't let an admin demote themselves (would lock out the panel)
    if (req.user && req.user.userId === userId && isAdmin === false) {
      return fail(req, res, 'ADMIN_CANNOT_DEMOTE_SELF');
    }

    // Answer the same 404 code as GET/DELETE instead of letting Prisma's P2025
    // surface as a generic NOT_FOUND.
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!target) return fail(req, res, 'USER_NOT_FOUND');

    const data: Record<string, unknown> = {};
    if (isAdmin !== undefined) data.isAdmin = isAdmin;
    if (plan) data.plan = plan;
    if (firstName) data.firstName = firstName;
    if (lastName) data.lastName = lastName;
    if (password) data.password = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        plan: true,
        isAdmin: true,
        createdAt: true,
      },
    });

    res.json({ user });
  } catch (error) {
    return handleError(req, res, error, 'ADMIN_USER_UPDATE_FAILED');
  }
};

// ============================================================================
// Conversations (cross-user)
// ============================================================================

export const listConversations = async (req: Request, res: Response): Promise<void> => {
  try {
    const search = String(req.query.search || '').trim();
    const platform = String(req.query.platform || '').trim();
    const status = String(req.query.status || '').trim();
    const userId = String(req.query.userId || '').trim();
    const pageId = String(req.query.pageId || '').trim();
    const agentId = String(req.query.agentId || '').trim();
    const minMessages = req.query.minMessages ? Number(req.query.minMessages) : undefined;
    const startDate = String(req.query.startDate || '').trim();
    const endDate = String(req.query.endDate || '').trim();
    const { limit, offset } = pagination(req.query, { limit: 50, maxLimit: 200 });

    const where: Record<string, unknown> = {};
    if (platform) where.platform = platform;
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (pageId) where.pageId = pageId;
    if (agentId) where.agentId = agentId;
    if (search) {
      where.OR = [
        { senderName: { contains: search } },
        { senderId: { contains: search } },
      ];
    }
    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.updatedAt = dateFilter;
    }

    const [conversationsRaw, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          senderName: true,
          senderId: true,
          platform: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          page: { select: { id: true, pageName: true, platform: true } },
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          agent: { select: { id: true, name: true } },
          _count: { select: { messages: true } },
          messages: {
            orderBy: { timestamp: 'desc' },
            take: 1,
            select: { text: true, isFromPage: true, timestamp: true },
          },
        },
      }),
      prisma.conversation.count({ where }),
    ]);

    // Flatten the latest-message-only relation into a `lastMessage` field
    const reshaped = conversationsRaw.map((c) => {
      const { messages, ...rest } = c as typeof c & { messages: Array<{ text: string | null; isFromPage: boolean; timestamp: Date }> };
      return {
        ...rest,
        lastMessage: messages[0]
          ? {
              text: messages[0].text,
              isFromPage: messages[0].isFromPage,
              timestamp: messages[0].timestamp,
            }
          : null,
      };
    });

    // Post-filter on minimum message count (Prisma can't do this directly)
    const conversations = (minMessages !== undefined && !Number.isNaN(minMessages))
      ? reshaped.filter((c) => c._count.messages >= minMessages)
      : reshaped;

    res.json({
      conversations,
      total: minMessages !== undefined && !Number.isNaN(minMessages) ? conversations.length : total,
    });
  } catch (error) {
    return handleError(req, res, error, 'ADMIN_CONVERSATIONS_LIST_FAILED');
  }
};

export const getConversationDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const conversationId = String(req.params.conversationId);

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        page: { select: { id: true, pageName: true, platform: true } },
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        agent: { select: { id: true, name: true, personality: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 200,
        },
        _count: { select: { messages: true } },
      },
    });

    if (!conversation) return fail(req, res, 'CONVERSATION_NOT_FOUND');

    res.json({ conversation });
  } catch (error) {
    return handleError(req, res, error, 'ADMIN_CONVERSATION_FETCH_FAILED');
  }
};

// ============================================================================
// Products (cross-user)
// ============================================================================

export const listAdminProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const search = String(req.query.search || '').trim();
    const { limit, offset } = pagination(req.query, { limit: 50, maxLimit: 200 });
    const lowStockOnly = req.query.lowStock === 'true';
    const userId = String(req.query.userId || '').trim();
    const categoryId = String(req.query.categoryId || '').trim();
    const isActive = req.query.isActive as string | undefined;
    const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : undefined;
    const minStock = req.query.minStock ? Number(req.query.minStock) : undefined;
    const maxStock = req.query.maxStock ? Number(req.query.maxStock) : undefined;
    const hasImage = req.query.hasImage as string | undefined;

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (categoryId) where.categoryId = categoryId;
    if (isActive === 'true') where.isActive = true;
    if (isActive === 'false') where.isActive = false;
    if (hasImage === 'true') where.imageUrl = { not: null };
    if (hasImage === 'false') where.imageUrl = null;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
      ];
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      const priceFilter: Record<string, number> = {};
      if (minPrice !== undefined) priceFilter.gte = minPrice;
      if (maxPrice !== undefined) priceFilter.lte = maxPrice;
      where.sellingPrice = priceFilter;
    }
    if (minStock !== undefined || maxStock !== undefined) {
      const stockFilter: Record<string, number> = {};
      if (minStock !== undefined) stockFilter.gte = minStock;
      if (maxStock !== undefined) stockFilter.lte = maxStock;
      where.quantity = stockFilter;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          name: true,
          sku: true,
          description: true,
          imageUrl: true,
          costPrice: true,
          sellingPrice: true,
          quantity: true,
          minQuantity: true,
          isActive: true,
          createdAt: true,
          userId: true,
          category: { select: { id: true, name: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    // Resolve users for each product (since Product.userId is a String, not a relation on User)
    const userIds = Array.from(new Set(products.map((p) => p.userId).filter(Boolean))) as string[];
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, firstName: true, lastName: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const enriched = products.map((p) => ({
      ...p,
      isLowStock: p.quantity <= p.minQuantity,
      owner: p.userId ? userMap.get(p.userId) || null : null,
    }));

    const filteredByLow = lowStockOnly ? enriched.filter((p) => p.isLowStock) : enriched;

    res.json({ products: filteredByLow, total: lowStockOnly ? filteredByLow.length : total });
  } catch (error) {
    return handleError(req, res, error, 'ADMIN_PRODUCTS_LIST_FAILED');
  }
};

// ============================================================================
// Lookup data for filter dropdowns
// ============================================================================

export const listAllCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      select: { id: true, name: true, userId: true },
      orderBy: { name: 'asc' },
      take: 500,
    });
    res.json({ categories });
  } catch (error) {
    return handleError(req, res, error, 'ADMIN_LOOKUP_FAILED');
  }
};

export const listAllPages = async (req: Request, res: Response): Promise<void> => {
  try {
    const pages = await prisma.page.findMany({
      select: { id: true, pageName: true, platform: true, userId: true },
      orderBy: { pageName: 'asc' },
      take: 500,
    });
    res.json({ pages });
  } catch (error) {
    return handleError(req, res, error, 'ADMIN_LOOKUP_FAILED');
  }
};

export const listAllAgents = async (req: Request, res: Response): Promise<void> => {
  try {
    const agents = await prisma.agent.findMany({
      select: { id: true, name: true, userId: true },
      orderBy: { name: 'asc' },
      take: 500,
    });
    res.json({ agents });
  } catch (error) {
    return handleError(req, res, error, 'ADMIN_LOOKUP_FAILED');
  }
};

// ============================================================================
// System settings (admin)
// ============================================================================
// We don't have a dedicated Settings table; use AIProvider table for AI keys
// (already done) and store other system flags in-memory for now or as a small
// "Settings" key/value table later. For now expose a simple admin profile +
// password rotation endpoint.

export const updateAdminProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const body = (req.body ?? {}) as Record<string, unknown>;

    const v = new Validator();
    const firstName = v.optionalString(body.firstName, 'firstName', { max: 100 });
    const lastName = v.optionalString(body.lastName, 'lastName', { max: 100 });
    const wantsPassword = typeof body.password === 'string' && body.password.trim() !== '';
    const password = wantsPassword ? v.requiredString(body.password, 'password', { min: 8, max: 128 }) : null;
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    v.throwIfAny();

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) return fail(req, res, 'USER_NOT_FOUND');

    const data: Record<string, unknown> = {};
    if (firstName) data.firstName = firstName;
    if (lastName) data.lastName = lastName;

    // Password change requires the current password
    if (password) {
      if (!currentPassword) return fail(req, res, 'ADMIN_CURRENT_PASSWORD_REQUIRED');
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) return fail(req, res, 'ADMIN_CURRENT_PASSWORD_INCORRECT');
      data.password = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.user.update({
      where: { id: req.user.userId },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        plan: true,
        isAdmin: true,
      },
    });

    res.json({ user: updated });
  } catch (error) {
    return handleError(req, res, error, 'ADMIN_PROFILE_UPDATE_FAILED');
  }
};

// ============================================================================
// Subscriptions (admin-managed user → plan links with billing dates)
// ============================================================================

const monthsLater = (start: Date, months: number): Date => {
  const d = new Date(start);
  d.setMonth(d.getMonth() + months);
  return d;
};

export const listSubscriptions = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = String(req.query.status || '').trim();
    const planSlug = String(req.query.planSlug || '').trim();
    const search = String(req.query.search || '').trim();
    const { limit, offset } = pagination(req.query, { limit: 100, maxLimit: 500 });

    const v = new Validator();
    const expiringBefore = v.date(req.query.expiringBefore, 'expiringBefore');
    v.throwIfAny();

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (planSlug) where.planSlug = planSlug;
    if (expiringBefore) {
      where.endDate = { lte: expiringBefore };
    }

    const [subs, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        orderBy: { endDate: 'asc' },
        take: limit,
        skip: offset,
      }),
      prisma.subscription.count({ where }),
    ]);

    // Resolve users
    const userIds = Array.from(new Set(subs.map((s) => s.userId)));
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, firstName: true, lastName: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Resolve plans
    const planSlugs = Array.from(new Set(subs.map((s) => s.planSlug)));
    const plans = planSlugs.length
      ? await prisma.plan.findMany({
          where: { slug: { in: planSlugs } },
          select: { id: true, slug: true, name: true, priceMonthly: true, priceYearly: true, currency: true },
        })
      : [];
    const planMap = new Map(plans.map((p) => [p.slug, p]));

    let enriched = subs.map((s) => ({
      ...s,
      user: userMap.get(s.userId) || null,
      plan: planMap.get(s.planSlug) || null,
    }));

    // Optional client-side text search (post-fetch since user data isn't a relation here)
    if (search) {
      const q = search.toLowerCase();
      enriched = enriched.filter((s) => {
        const u = s.user;
        if (!u) return false;
        return (
          u.email.toLowerCase().includes(q) ||
          u.firstName.toLowerCase().includes(q) ||
          u.lastName.toLowerCase().includes(q)
        );
      });
    }

    res.json({ subscriptions: enriched, total: search ? enriched.length : total });
  } catch (error) {
    return handleError(req, res, error, 'SUBSCRIPTION_LIST_FAILED');
  }
};

export const createSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const v = new Validator();
    const userId = v.requiredString(body.userId, 'userId', { max: 64 });
    const planSlug = v.requiredString(body.planSlug, 'planSlug', { max: 100 });
    const billingCycle = v.oneOf(body.billingCycle, 'billingCycle', BILLING_CYCLES, 'monthly');
    const status = v.oneOf(body.status, 'status', SUBSCRIPTION_STATUSES, 'active');
    const startDate = v.date(body.startDate, 'startDate');
    const endDate = v.date(body.endDate, 'endDate');
    const notes = v.optionalString(body.notes, 'notes', { max: 2000 });
    const chargilySubscriptionId = v.optionalString(body.chargilySubscriptionId, 'chargilySubscriptionId', { max: 191 });
    const chargilyCustomerId = v.optionalString(body.chargilyCustomerId, 'chargilyCustomerId', { max: 191 });
    v.throwIfAny();

    const start = startDate ?? new Date();
    const end = endDate ?? monthsLater(start, billingCycle === 'yearly' ? 12 : 1);
    if (end.getTime() < start.getTime()) return fail(req, res, 'INVALID_DATE_RANGE');

    // Verify the user and plan exist
    const [user, plan] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.plan.findUnique({ where: { slug: planSlug } }),
    ]);
    if (!user) return fail(req, res, 'USER_NOT_FOUND');
    if (!plan) return fail(req, res, 'PLAN_NOT_FOUND');

    // Business rule: one active subscription per user
    if (status === 'active') {
      const active = await prisma.subscription.findFirst({ where: { userId, status: 'active' }, select: { id: true } });
      if (active) return fail(req, res, 'SUBSCRIPTION_ALREADY_ACTIVE');
    }

    const sub = await prisma.subscription.create({
      data: {
        userId,
        planSlug,
        billingCycle,
        startDate: start,
        endDate: end,
        status,
        notes,
        chargilySubscriptionId,
        chargilyCustomerId,
      },
    });

    // Also update the user's plan field so it stays in sync
    await prisma.user.update({
      where: { id: userId },
      data: { plan: planSlug },
    });

    res.status(201).json({ subscription: sub });
  } catch (error) {
    return handleError(req, res, error, 'SUBSCRIPTION_CREATE_FAILED');
  }
};

export const updateSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const subId = String(req.params.subId);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const has = (k: string) => body[k] !== undefined && body[k] !== null;

    // Whitelist the editable fields (no mass assignment into Prisma)
    const v = new Validator();
    const planSlug = has('planSlug') ? v.requiredString(body.planSlug, 'planSlug', { max: 100 }) : undefined;
    const billingCycle = has('billingCycle') ? v.oneOf(body.billingCycle, 'billingCycle', BILLING_CYCLES) : undefined;
    const status = has('status') ? v.oneOf(body.status, 'status', SUBSCRIPTION_STATUSES) : undefined;
    const startDate = has('startDate') ? v.date(body.startDate, 'startDate', { required: true }) : undefined;
    const endDate = has('endDate') ? v.date(body.endDate, 'endDate', { required: true }) : undefined;
    const cancelledAt = has('cancelledAt') ? v.date(body.cancelledAt, 'cancelledAt', { required: true }) : undefined;
    const notes = body.notes === undefined ? undefined : v.optionalString(body.notes, 'notes', { max: 2000 });
    const chargilySubscriptionId = body.chargilySubscriptionId === undefined ? undefined : v.optionalString(body.chargilySubscriptionId, 'chargilySubscriptionId', { max: 191 });
    const chargilyCustomerId = body.chargilyCustomerId === undefined ? undefined : v.optionalString(body.chargilyCustomerId, 'chargilyCustomerId', { max: 191 });
    v.throwIfAny();

    const existing = await prisma.subscription.findUnique({ where: { id: subId } });
    if (!existing) return fail(req, res, 'SUBSCRIPTION_NOT_FOUND');

    if (planSlug !== undefined && planSlug !== existing.planSlug) {
      const plan = await prisma.plan.findUnique({ where: { slug: planSlug }, select: { id: true } });
      if (!plan) return fail(req, res, 'PLAN_NOT_FOUND');
    }

    const finalStart = startDate ?? existing.startDate;
    const finalEnd = endDate ?? existing.endDate;
    if (finalEnd.getTime() < finalStart.getTime()) return fail(req, res, 'INVALID_DATE_RANGE');

    if (status === 'active' && existing.status !== 'active') {
      const other = await prisma.subscription.findFirst({
        where: { userId: existing.userId, status: 'active', id: { not: subId } },
        select: { id: true },
      });
      if (other) return fail(req, res, 'SUBSCRIPTION_ALREADY_ACTIVE');
    }

    const data: Record<string, unknown> = {};
    if (planSlug !== undefined) data.planSlug = planSlug;
    if (billingCycle !== undefined) data.billingCycle = billingCycle;
    if (status !== undefined) data.status = status;
    if (startDate) data.startDate = startDate;
    if (endDate) data.endDate = endDate;
    if (cancelledAt) data.cancelledAt = cancelledAt;
    if (notes !== undefined) data.notes = notes;
    if (chargilySubscriptionId !== undefined) data.chargilySubscriptionId = chargilySubscriptionId;
    if (chargilyCustomerId !== undefined) data.chargilyCustomerId = chargilyCustomerId;
    if (status === 'cancelled' && !cancelledAt && !existing.cancelledAt) data.cancelledAt = new Date();
    if (Object.keys(data).length === 0) return fail(req, res, 'SUBSCRIPTION_NO_CHANGES');

    const sub = await prisma.subscription.update({
      where: { id: subId },
      data,
    });

    // If planSlug changed, sync user.plan
    if (planSlug !== undefined) {
      await prisma.user.update({
        where: { id: sub.userId },
        data: { plan: planSlug },
      });
    }

    res.json({ subscription: sub });
  } catch (error) {
    return handleError(req, res, error, 'SUBSCRIPTION_UPDATE_FAILED');
  }
};

export const deleteSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const subId = String(req.params.subId);
    const existing = await prisma.subscription.findUnique({ where: { id: subId }, select: { id: true } });
    if (!existing) return fail(req, res, 'SUBSCRIPTION_NOT_FOUND');
    await prisma.subscription.delete({ where: { id: subId } });
    res.json({ success: true });
  } catch (error) {
    return handleError(req, res, error, 'SUBSCRIPTION_DELETE_FAILED');
  }
};

// ============================================================================
// CMS Pages (company + legal)
// ============================================================================

export const listCmsPages = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = String(req.query.category || '').trim();
    const where: Record<string, unknown> = {};
    if (category) where.category = category;

    const pages = await prisma.cmsPage.findMany({
      where,
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
    res.json({ pages });
  } catch (error) {
    return handleError(req, res, error, 'CMS_LIST_FAILED');
  }
};

export const getCmsPage = async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = String(req.params.slug);
    const page = await prisma.cmsPage.findUnique({ where: { slug } });
    if (!page) return fail(req, res, 'CMS_PAGE_NOT_FOUND');
    res.json({ page });
  } catch (error) {
    return handleError(req, res, error, 'CMS_FETCH_FAILED');
  }
};

export const upsertCmsPage = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const v = new Validator();
    const slug = v.requiredString(body.slug, 'slug', { max: 100 }).toLowerCase();
    if (slug && !SLUG_RE.test(slug)) v.add('slug', 'FIELD_INVALID');
    const title = v.requiredString(body.title, 'title', { max: 200 });
    const category = v.oneOf(body.category, 'category', CMS_CATEGORIES);
    const content = typeof body.content === 'string' ? body.content : '';
    if (content.trim() === '') v.add('content', 'FIELD_REQUIRED');
    const isPublished = v.boolean(body.isPublished, 'isPublished', true);
    const sortOrder = v.integer(body.sortOrder, 'sortOrder', { required: false, def: 0, min: 0 });
    v.throwIfAny();

    const page = await prisma.cmsPage.upsert({
      where: { slug },
      update: { title, category, content, isPublished, sortOrder },
      create: {
        slug,
        title,
        category,
        content,
        isPublished,
        sortOrder,
      },
    });
    res.json({ page });
  } catch (error) {
    return handleError(req, res, error, 'CMS_SAVE_FAILED');
  }
};

export const deleteCmsPage = async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = String(req.params.slug);
    const existing = await prisma.cmsPage.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return fail(req, res, 'CMS_PAGE_NOT_FOUND');
    await prisma.cmsPage.delete({ where: { slug } });
    res.json({ success: true });
  } catch (error) {
    return handleError(req, res, error, 'CMS_DELETE_FAILED');
  }
};

// ============================================================================
// Plans (subscription tiers)
// ============================================================================

const parsePlan = (p: { features: string } & Record<string, unknown>) => ({
  ...p,
  features: (() => {
    try {
      return JSON.parse(p.features) as string[];
    } catch {
      return [];
    }
  })(),
});

export const listPlans = async (req: Request, res: Response): Promise<void> => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const subscribers = await prisma.user.groupBy({
      by: ['plan'],
      _count: { _all: true },
    });
    const subscriberMap = new Map(subscribers.map((s) => [s.plan, s._count._all]));

    res.json({
      plans: plans.map((p) => ({
        ...parsePlan(p),
        subscriberCount: subscriberMap.get(p.slug) || 0,
      })),
    });
  } catch (error) {
    return handleError(req, res, error, 'PLAN_LIST_FAILED');
  }
};

export const createPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const v = new Validator();
    const rawSlug = v.requiredString(body.slug, 'slug', { max: 100 });
    const slug = rawSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (rawSlug && !SLUG_RE.test(slug)) v.add('slug', 'FIELD_INVALID');
    const name = v.requiredString(body.name, 'name', { max: 120 });
    const description = v.optionalString(body.description, 'description', { max: 5000 });
    const priceMonthly = v.number(body.priceMonthly, 'priceMonthly', { required: false, def: 0, min: 0 });
    const priceYearly = v.number(body.priceYearly, 'priceYearly', { required: false, def: 0, min: 0 });
    const currency = v.optionalString(body.currency, 'currency', { max: 5 }) ?? 'DA';
    if (!CURRENCY_RE.test(currency)) v.add('currency', 'FIELD_INVALID');
    const maxPages = v.integer(body.maxPages, 'maxPages', { required: false, def: 1, min: -1 });
    const maxAgents = v.integer(body.maxAgents, 'maxAgents', { required: false, def: 1, min: -1 });
    const maxProducts = v.integer(body.maxProducts, 'maxProducts', { required: false, def: 50, min: -1 });
    const maxConversations = v.integer(body.maxConversations, 'maxConversations', { required: false, def: 100, min: -1 });
    const maxTeamMembers = v.integer(body.maxTeamMembers, 'maxTeamMembers', { required: false, def: 1, min: -1 });
    const monthlyCredits = v.integer(body.monthlyCredits, 'monthlyCredits', { required: false, def: 500, min: -1 });
    const features = featureList(v, body.features, 'features') ?? [];
    const isActive = v.boolean(body.isActive, 'isActive', true);
    const isFeatured = v.boolean(body.isFeatured, 'isFeatured', false);
    const sortOrder = v.integer(body.sortOrder, 'sortOrder', { required: false, def: 0, min: 0 });
    const chargilyProductId = v.optionalString(body.chargilyProductId, 'chargilyProductId', { max: 191 });
    const chargilyPriceMonthlyId = v.optionalString(body.chargilyPriceMonthlyId, 'chargilyPriceMonthlyId', { max: 191 });
    const chargilyPriceYearlyId = v.optionalString(body.chargilyPriceYearlyId, 'chargilyPriceYearlyId', { max: 191 });
    v.throwIfAny();

    const taken = await prisma.plan.findUnique({ where: { slug }, select: { id: true } });
    if (taken) return fail(req, res, 'PLAN_SLUG_TAKEN', { slug });

    const plan = await prisma.plan.create({
      data: {
        slug,
        name,
        description,
        priceMonthly,
        priceYearly,
        currency: currency.toUpperCase(),
        maxPages,
        maxAgents,
        maxProducts,
        maxConversations,
        maxTeamMembers,
        monthlyCredits,
        features: JSON.stringify(features),
        isActive,
        isFeatured,
        sortOrder,
        chargilyProductId,
        chargilyPriceMonthlyId,
        chargilyPriceYearlyId,
      },
    });

    res.status(201).json({ plan: parsePlan(plan) });
  } catch (error) {
    return handleError(req, res, error, 'PLAN_CREATE_FAILED');
  }
};

export const updatePlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const planId = String(req.params.planId);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const has = (k: string) => body[k] !== undefined && body[k] !== null;

    // Whitelist the editable fields (no mass assignment into Prisma)
    const v = new Validator();
    const data: Record<string, unknown> = {};

    if (has('slug')) {
      const rawSlug = v.requiredString(body.slug, 'slug', { max: 100 });
      const slug = rawSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      if (rawSlug && !SLUG_RE.test(slug)) v.add('slug', 'FIELD_INVALID');
      data.slug = slug;
    }
    if (has('name')) data.name = v.requiredString(body.name, 'name', { max: 120 });
    if (body.description !== undefined) data.description = v.optionalString(body.description, 'description', { max: 5000 });
    if (has('priceMonthly')) data.priceMonthly = v.number(body.priceMonthly, 'priceMonthly', { min: 0 });
    if (has('priceYearly')) data.priceYearly = v.number(body.priceYearly, 'priceYearly', { min: 0 });
    if (has('currency')) {
      const currency = v.requiredString(body.currency, 'currency', { max: 5 });
      if (currency && !CURRENCY_RE.test(currency)) v.add('currency', 'FIELD_INVALID');
      data.currency = currency.toUpperCase();
    }
    for (const limitField of ['maxPages', 'maxAgents', 'maxProducts', 'maxConversations', 'maxTeamMembers', 'monthlyCredits'] as const) {
      if (has(limitField)) data[limitField] = v.integer(body[limitField], limitField, { min: -1 });
    }
    if (has('features')) {
      const features = featureList(v, body.features, 'features');
      if (features) data.features = JSON.stringify(features);
    }
    for (const boolField of ['isActive', 'isFeatured'] as const) {
      const b = optionalBool(v, body[boolField], boolField);
      if (b !== undefined) data[boolField] = b;
    }
    if (has('sortOrder')) data.sortOrder = v.integer(body.sortOrder, 'sortOrder', { min: 0 });
    for (const idField of ['chargilyProductId', 'chargilyPriceMonthlyId', 'chargilyPriceYearlyId'] as const) {
      if (body[idField] !== undefined) data[idField] = v.optionalString(body[idField], idField, { max: 191 });
    }
    v.throwIfAny();
    if (Object.keys(data).length === 0) return fail(req, res, 'PLAN_NO_CHANGES');

    const existing = await prisma.plan.findUnique({ where: { id: planId }, select: { id: true, slug: true } });
    if (!existing) return fail(req, res, 'PLAN_NOT_FOUND');

    if (typeof data.slug === 'string' && data.slug !== existing.slug) {
      const taken = await prisma.plan.findUnique({ where: { slug: data.slug }, select: { id: true } });
      if (taken) return fail(req, res, 'PLAN_SLUG_TAKEN', { slug: data.slug });
    }

    const plan = await prisma.plan.update({
      where: { id: planId },
      data,
    });
    res.json({ plan: parsePlan(plan) });
  } catch (error) {
    return handleError(req, res, error, 'PLAN_UPDATE_FAILED');
  }
};

export const deletePlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const planId = String(req.params.planId);
    const existing = await prisma.plan.findUnique({ where: { id: planId }, select: { id: true, slug: true } });
    if (!existing) return fail(req, res, 'PLAN_NOT_FOUND');

    // Business rule: a plan still assigned to users (or active subscriptions) cannot be removed
    const [usersOnPlan, activeSubs] = await Promise.all([
      prisma.user.count({ where: { plan: existing.slug } }),
      prisma.subscription.count({ where: { planSlug: existing.slug, status: { in: ['active', 'trial'] } } }),
    ]);
    if (usersOnPlan > 0 || activeSubs > 0) {
      return fail(req, res, 'PLAN_IN_USE', { count: Math.max(usersOnPlan, activeSubs) });
    }

    await prisma.plan.delete({ where: { id: planId } });
    res.json({ success: true });
  } catch (error) {
    return handleError(req, res, error, 'PLAN_DELETE_FAILED');
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String(req.params.userId);

    if (req.user && req.user.userId === userId) return fail(req, res, 'ADMIN_CANNOT_DELETE_SELF');

    const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!existing) return fail(req, res, 'USER_NOT_FOUND');

    await prisma.user.delete({ where: { id: userId } });
    res.json({ success: true });
  } catch (error) {
    return handleError(req, res, error, 'ADMIN_USER_DELETE_FAILED');
  }
};
