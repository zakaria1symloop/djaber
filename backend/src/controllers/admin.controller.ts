import { Request, Response } from 'express';
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
