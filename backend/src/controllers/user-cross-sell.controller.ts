import { Request, Response } from 'express';
import prisma from '../config/database';
import { generateRecommendations as runEngine } from '../services/recommendation.service';
import { fail, handleError } from '../errors';
import { Validator } from '../middleware/validate';

const RECOMMENDATION_TYPES = ['cross_sell', 'up_sell'] as const;

// ============================================================================
// GET /cross-sell — List all recommendations
// ============================================================================

export const getRecommendations = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const userId = req.user.userId;

    const v = new Validator();
    const search = v.optionalString(req.query.search, 'search', { max: 200 });
    const type = req.query.type === undefined || req.query.type === '' ? undefined : v.oneOf(req.query.type, 'type', RECOMMENDATION_TYPES);
    const isActive = req.query.isActive === undefined || req.query.isActive === '' ? undefined : v.boolean(req.query.isActive, 'isActive');
    v.throwIfAny();

    const where: Record<string, unknown> = { userId };
    if (type) where.type = type;
    if (isActive !== undefined) where.isActive = isActive;

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
    handleError(req, res, error, 'CROSS_SELL_LIST_FAILED');
  }
};

// ============================================================================
// GET /cross-sell/stats — Summary stats
// ============================================================================

export const getRecommendationStats = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const userId = req.user.userId;

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
    handleError(req, res, error, 'CROSS_SELL_STATS_FAILED');
  }
};

// ============================================================================
// GET /cross-sell/product/:productId — Recommendations for a specific product
// ============================================================================

export const getProductRecommendations = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const userId = req.user.userId;
    const productId = String(req.params.productId);

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
    handleError(req, res, error, 'CROSS_SELL_LIST_FAILED');
  }
};

// ============================================================================
// POST /cross-sell/generate — Trigger recommendation engine
// ============================================================================

export const generateRecommendationsEndpoint = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const count = await runEngine(req.user.userId);
    res.json({ success: true, count, message: `Generated ${count} recommendations` });
  } catch (error) {
    handleError(req, res, error, 'CROSS_SELL_GENERATE_FAILED');
  }
};

// ============================================================================
// PUT /cross-sell/:id — Update a recommendation (toggle active, etc.)
// ============================================================================

export const updateRecommendation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const userId = req.user.userId;
    const id = String(req.params.id);
    const b = req.body ?? {};

    const v = new Validator();
    const isActive = b.isActive === undefined || b.isActive === null ? undefined : v.boolean(b.isActive, 'isActive');
    v.throwIfAny();

    const existing = await prisma.productRecommendation.findFirst({ where: { id, userId } });
    if (!existing) return fail(req, res, 'RECOMMENDATION_NOT_FOUND');

    const updated = await prisma.productRecommendation.update({
      where: { id },
      data: { isActive: isActive !== undefined ? isActive : existing.isActive },
    });

    res.json(updated);
  } catch (error) {
    handleError(req, res, error, 'CROSS_SELL_UPDATE_FAILED');
  }
};

// ============================================================================
// DELETE /cross-sell/:id — Delete a recommendation
// ============================================================================

export const deleteRecommendation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const userId = req.user.userId;
    const id = String(req.params.id);

    const existing = await prisma.productRecommendation.findFirst({ where: { id, userId } });
    if (!existing) return fail(req, res, 'RECOMMENDATION_NOT_FOUND');

    await prisma.productRecommendation.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    handleError(req, res, error, 'CROSS_SELL_DELETE_FAILED');
  }
};
