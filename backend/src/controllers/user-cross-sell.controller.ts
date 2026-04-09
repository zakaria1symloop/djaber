import { Request, Response } from 'express';
import prisma from '../config/database';
import { generateRecommendations as runEngine } from '../services/recommendation.service';

// ============================================================================
// GET /cross-sell — List all recommendations
// ============================================================================

export const getRecommendations = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const search = req.query.search as string | undefined;
    const type = req.query.type as string | undefined;
    const isActive = req.query.isActive as string | undefined;

    const where: any = { userId };

    if (type && (type === 'cross_sell' || type === 'up_sell')) {
      where.type = type;
    }

    if (isActive === 'true') where.isActive = true;
    else if (isActive === 'false') where.isActive = false;

    const recommendations = await prisma.productRecommendation.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true, sellingPrice: true } },
        recommended: { select: { id: true, name: true, sku: true, sellingPrice: true } },
      },
      orderBy: { score: 'desc' },
    });

    // Apply search filter on product names
    let filtered = recommendations;
    if (search) {
      const s = search.toLowerCase();
      filtered = recommendations.filter(
        r =>
          r.product.name.toLowerCase().includes(s) ||
          r.recommended.name.toLowerCase().includes(s) ||
          r.product.sku.toLowerCase().includes(s) ||
          r.recommended.sku.toLowerCase().includes(s)
      );
    }

    res.json(filtered);
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
};

// ============================================================================
// GET /cross-sell/stats — Summary stats
// ============================================================================

export const getRecommendationStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;

    const [total, active, aggregates] = await Promise.all([
      prisma.productRecommendation.count({ where: { userId } }),
      prisma.productRecommendation.count({ where: { userId, isActive: true } }),
      prisma.productRecommendation.aggregate({
        where: { userId },
        _sum: { impressions: true, conversions: true, revenue: true },
      }),
    ]);

    const totalImpressions = aggregates._sum.impressions || 0;
    const totalConversions = aggregates._sum.conversions || 0;
    const totalRevenue = Number(aggregates._sum.revenue || 0);
    const conversionRate = totalImpressions > 0
      ? Math.round((totalConversions / totalImpressions) * 10000) / 100
      : 0;

    res.json({
      total,
      active,
      totalImpressions,
      totalConversions,
      conversionRate,
      totalRevenue,
    });
  } catch (error) {
    console.error('Error fetching recommendation stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

// ============================================================================
// GET /cross-sell/product/:productId — Recommendations for a specific product
// ============================================================================

export const getProductRecommendations = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const productId = req.params.productId as string;

    const recommendations = await prisma.productRecommendation.findMany({
      where: { userId, productId, isActive: true },
      include: {
        recommended: { select: { id: true, name: true, sku: true, sellingPrice: true, quantity: true } },
      },
      orderBy: { score: 'desc' },
      take: 10,
    });

    res.json(recommendations);
  } catch (error) {
    console.error('Error fetching product recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch product recommendations' });
  }
};

// ============================================================================
// POST /cross-sell/generate — Trigger recommendation engine
// ============================================================================

export const generateRecommendationsEndpoint = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const count = await runEngine(userId);
    res.json({ success: true, count, message: `Generated ${count} recommendations` });
  } catch (error) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
};

// ============================================================================
// PUT /cross-sell/:id — Update a recommendation (toggle active, etc.)
// ============================================================================

export const updateRecommendation = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const id = req.params.id as string;
    const { isActive } = req.body;

    const existing = await prisma.productRecommendation.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Recommendation not found' });
      return;
    }

    const updated = await prisma.productRecommendation.update({
      where: { id },
      data: { isActive: isActive !== undefined ? isActive : existing.isActive },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating recommendation:', error);
    res.status(500).json({ error: 'Failed to update recommendation' });
  }
};

// ============================================================================
// DELETE /cross-sell/:id — Delete a recommendation
// ============================================================================

export const deleteRecommendation = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const id = req.params.id as string;

    const existing = await prisma.productRecommendation.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Recommendation not found' });
      return;
    }

    await prisma.productRecommendation.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting recommendation:', error);
    res.status(500).json({ error: 'Failed to delete recommendation' });
  }
};
