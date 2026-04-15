import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/database';

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
    console.error('Get admin analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch admin analytics' });
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
    const limit = Math.min(Number(req.query.limit) || 50, 500);
    const offset = Number(req.query.offset) || 0;

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
    console.error('List users error:', error);
    res.status(500).json({ error: 'Failed to list users' });
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

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

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
    console.error('Get user details error:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String(req.params.userId);
    const { isAdmin, plan, firstName, lastName, password } = req.body;

    // Don't let an admin demote themselves (would lock out the panel)
    if (req.user && req.user.userId === userId && isAdmin === false) {
      res.status(400).json({ error: 'You cannot remove your own admin role' });
      return;
    }

    const data: Record<string, unknown> = {};
    if (typeof isAdmin === 'boolean') data.isAdmin = isAdmin;
    if (typeof plan === 'string' && ['individual', 'teams'].includes(plan)) data.plan = plan;
    if (typeof firstName === 'string' && firstName.trim()) data.firstName = firstName.trim();
    if (typeof lastName === 'string' && lastName.trim()) data.lastName = lastName.trim();
    if (typeof password === 'string' && password.length >= 8) {
      data.password = await bcrypt.hash(password, 10);
    }

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
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
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
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;

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
        },
      }),
      prisma.conversation.count({ where }),
    ]);

    // Post-filter on minimum message count (Prisma can't do this directly)
    const conversations = (minMessages !== undefined && !Number.isNaN(minMessages))
      ? conversationsRaw.filter((c) => c._count.messages >= minMessages)
      : conversationsRaw;

    res.json({
      conversations,
      total: minMessages !== undefined && !Number.isNaN(minMessages) ? conversations.length : total,
    });
  } catch (error) {
    console.error('List conversations error:', error);
    res.status(500).json({ error: 'Failed to list conversations' });
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

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    res.json({ conversation });
  } catch (error) {
    console.error('Get conversation details error:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
};

// ============================================================================
// Products (cross-user)
// ============================================================================

export const listAdminProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const search = String(req.query.search || '').trim();
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
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
    console.error('List admin products error:', error);
    res.status(500).json({ error: 'Failed to list products' });
  }
};

// ============================================================================
// Lookup data for filter dropdowns
// ============================================================================

export const listAllCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      select: { id: true, name: true, userId: true },
      orderBy: { name: 'asc' },
      take: 500,
    });
    res.json({ categories });
  } catch (error) {
    console.error('List all categories error:', error);
    res.status(500).json({ error: 'Failed to list categories' });
  }
};

export const listAllPages = async (_req: Request, res: Response): Promise<void> => {
  try {
    const pages = await prisma.page.findMany({
      select: { id: true, pageName: true, platform: true, userId: true },
      orderBy: { pageName: 'asc' },
      take: 500,
    });
    res.json({ pages });
  } catch (error) {
    console.error('List all pages error:', error);
    res.status(500).json({ error: 'Failed to list pages' });
  }
};

export const listAllAgents = async (_req: Request, res: Response): Promise<void> => {
  try {
    const agents = await prisma.agent.findMany({
      select: { id: true, name: true, userId: true },
      orderBy: { name: 'asc' },
      take: 500,
    });
    res.json({ agents });
  } catch (error) {
    console.error('List all agents error:', error);
    res.status(500).json({ error: 'Failed to list agents' });
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
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { firstName, lastName, password, currentPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const data: Record<string, unknown> = {};
    if (typeof firstName === 'string' && firstName.trim()) data.firstName = firstName.trim();
    if (typeof lastName === 'string' && lastName.trim()) data.lastName = lastName.trim();

    // Password change requires the current password
    if (typeof password === 'string' && password.trim()) {
      if (password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters' });
        return;
      }
      if (!currentPassword || typeof currentPassword !== 'string') {
        res.status(400).json({ error: 'Current password is required to change password' });
        return;
      }
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) {
        res.status(400).json({ error: 'Current password is incorrect' });
        return;
      }
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
    console.error('Update admin profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
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
    const expiringBefore = String(req.query.expiringBefore || '').trim();
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Number(req.query.offset) || 0;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (planSlug) where.planSlug = planSlug;
    if (expiringBefore) {
      where.endDate = { lte: new Date(expiringBefore) };
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
    console.error('List subscriptions error:', error);
    res.status(500).json({ error: 'Failed to list subscriptions' });
  }
};

export const createSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      userId,
      planSlug,
      billingCycle = 'monthly',
      startDate,
      endDate,
      status = 'active',
      notes,
      chargilySubscriptionId,
      chargilyCustomerId,
    } = req.body;

    if (!userId || !planSlug) {
      res.status(400).json({ error: 'userId and planSlug are required' });
      return;
    }

    // Verify the user and plan exist
    const [user, plan] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.plan.findUnique({ where: { slug: planSlug } }),
    ]);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (!plan) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }

    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate
      ? new Date(endDate)
      : monthsLater(start, billingCycle === 'yearly' ? 12 : 1);

    const sub = await prisma.subscription.create({
      data: {
        userId,
        planSlug,
        billingCycle,
        startDate: start,
        endDate: end,
        status,
        notes: notes || null,
        chargilySubscriptionId: chargilySubscriptionId || null,
        chargilyCustomerId: chargilyCustomerId || null,
      },
    });

    // Also update the user's plan field so it stays in sync
    await prisma.user.update({
      where: { id: userId },
      data: { plan: planSlug },
    });

    res.status(201).json({ subscription: sub });
  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
};

export const updateSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const subId = String(req.params.subId);
    const data: Record<string, unknown> = { ...req.body };

    if (data.startDate) data.startDate = new Date(String(data.startDate));
    if (data.endDate) data.endDate = new Date(String(data.endDate));
    if (data.status === 'cancelled' && !data.cancelledAt) {
      data.cancelledAt = new Date();
    }

    const sub = await prisma.subscription.update({
      where: { id: subId },
      data,
    });

    // If planSlug changed, sync user.plan
    if (typeof data.planSlug === 'string') {
      await prisma.user.update({
        where: { id: sub.userId },
        data: { plan: data.planSlug },
      });
    }

    res.json({ subscription: sub });
  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
};

export const deleteSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const subId = String(req.params.subId);
    await prisma.subscription.delete({ where: { id: subId } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete subscription error:', error);
    res.status(500).json({ error: 'Failed to delete subscription' });
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
    console.error('List CMS pages error:', error);
    res.status(500).json({ error: 'Failed to list pages' });
  }
};

export const getCmsPage = async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = String(req.params.slug);
    const page = await prisma.cmsPage.findUnique({ where: { slug } });
    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }
    res.json({ page });
  } catch (error) {
    console.error('Get CMS page error:', error);
    res.status(500).json({ error: 'Failed to fetch page' });
  }
};

export const upsertCmsPage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug, title, category, content, isPublished = true, sortOrder = 0 } = req.body;
    if (!slug || !title || !category) {
      res.status(400).json({ error: 'slug, title, and category are required' });
      return;
    }

    const page = await prisma.cmsPage.upsert({
      where: { slug: String(slug).toLowerCase() },
      update: { title, category, content: content || '', isPublished, sortOrder },
      create: {
        slug: String(slug).toLowerCase(),
        title,
        category,
        content: content || '',
        isPublished,
        sortOrder,
      },
    });
    res.json({ page });
  } catch (error) {
    console.error('Upsert CMS page error:', error);
    res.status(500).json({ error: 'Failed to save page' });
  }
};

export const deleteCmsPage = async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = String(req.params.slug);
    await prisma.cmsPage.delete({ where: { slug } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete CMS page error:', error);
    res.status(500).json({ error: 'Failed to delete page' });
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

export const listPlans = async (_req: Request, res: Response): Promise<void> => {
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
    console.error('List plans error:', error);
    res.status(500).json({ error: 'Failed to list plans' });
  }
};

export const createPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      slug,
      name,
      description,
      priceMonthly = 0,
      priceYearly = 0,
      currency = 'DA',
      maxPages = 1,
      maxAgents = 1,
      maxProducts = 50,
      maxConversations = 100,
      maxTeamMembers = 1,
      features = [],
      isActive = true,
      isFeatured = false,
      sortOrder = 0,
      chargilyProductId,
      chargilyPriceMonthlyId,
      chargilyPriceYearlyId,
    } = req.body;

    if (!slug || !name) {
      res.status(400).json({ error: 'slug and name are required' });
      return;
    }

    const plan = await prisma.plan.create({
      data: {
        slug: String(slug).toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        name,
        description: description || null,
        priceMonthly,
        priceYearly,
        currency,
        maxPages,
        maxAgents,
        maxProducts,
        maxConversations,
        maxTeamMembers,
        features: JSON.stringify(features),
        isActive,
        isFeatured,
        sortOrder,
        chargilyProductId: chargilyProductId || null,
        chargilyPriceMonthlyId: chargilyPriceMonthlyId || null,
        chargilyPriceYearlyId: chargilyPriceYearlyId || null,
      },
    });

    res.status(201).json({ plan: parsePlan(plan) });
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({ error: 'Failed to create plan' });
  }
};

export const updatePlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const planId = String(req.params.planId);
    const data: Record<string, unknown> = { ...req.body };

    if (data.features && Array.isArray(data.features)) {
      data.features = JSON.stringify(data.features);
    }
    if (data.slug) {
      data.slug = String(data.slug).toLowerCase().replace(/[^a-z0-9-]/g, '-');
    }

    const plan = await prisma.plan.update({
      where: { id: planId },
      data,
    });
    res.json({ plan: parsePlan(plan) });
  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({ error: 'Failed to update plan' });
  }
};

export const deletePlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const planId = String(req.params.planId);
    await prisma.plan.delete({ where: { id: planId } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete plan error:', error);
    res.status(500).json({ error: 'Failed to delete plan' });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String(req.params.userId);

    if (req.user && req.user.userId === userId) {
      res.status(400).json({ error: 'You cannot delete your own account' });
      return;
    }

    await prisma.user.delete({ where: { id: userId } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};
