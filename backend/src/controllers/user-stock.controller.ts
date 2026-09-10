import { Request, Response } from 'express';
import prisma from '../config/database';
import { analyzeProductImage } from '../services/ai.service';
import fs from 'fs';
import path from 'path';
import { ApiError, fail, handleError } from '../errors';
import { Validator, pagination } from '../middleware/validate';

// ============================================================================
// Limits / enums
// ============================================================================

const NAME_MAX = 255;
const SKU_MAX = 255;
const DESCRIPTION_MAX = 5000;
const COLOR_MAX = 20;
const UNIT_LABEL_MAX = 50;
const URL_MAX = 2048;
const PHONE_MAX = 50;
const ADDRESS_MAX = 1000;
const NOTES_MAX = 5000;
const REASON_MAX = 255;
const MOVEMENT_NOTES_MAX = 2000;
const EXPENSE_DESCRIPTION_MAX = 1000;

const MOVEMENT_TYPES = ['in', 'out', 'adjustment', 'return'] as const;
const VALID_EXPENSE_CATEGORIES = ['marketing', 'shipping', 'packaging', 'customs', 'storage', 'other'] as const;

// ============================================================================
// Ownership helpers (throw ApiError → handleError answers 404)
// ============================================================================

async function findOwnProduct(productId: string, userId: string) {
  const product = await prisma.product.findFirst({ where: { id: productId, userId } });
  if (!product) throw new ApiError('PRODUCT_NOT_FOUND');
  return product;
}

/** Category must belong to the caller (null/undefined → no category). */
async function assertOwnCategory(categoryId: string | null, userId: string): Promise<void> {
  if (!categoryId) return;
  const count = await prisma.category.count({ where: { id: categoryId, userId } });
  if (count === 0) throw new ApiError('CATEGORY_NOT_FOUND');
}

/** Unit must be a system default or one of the caller's custom units. */
async function assertUsableUnit(unitId: string | null, userId: string): Promise<void> {
  if (!unitId) return;
  const count = await prisma.unit.count({ where: { id: unitId, OR: [{ userId: null }, { userId }] } });
  if (count === 0) throw new ApiError('UNIT_NOT_FOUND');
}

/** Inclusive end-of-day for `endDate` filters. */
function endOfDay(d: Date): Date {
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return end;
}

// User-level stock management - uses userId instead of pageId

// ============================================================================
// Categories
// ============================================================================

export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const { search, minProducts, maxProducts, hasDescription, color } = req.query;
    const where: any = { userId: req.user.userId };

    if (search) {
      where.name = { contains: search as string };
    }

    // Has description filter
    if (hasDescription === 'true') {
      where.description = { not: null };
    } else if (hasDescription === 'false') {
      where.OR = [{ description: null }, { description: '' }];
    }

    // Color filter (comma-separated hex values)
    if (color) {
      const colors = (color as string).split(',').map(c => c.trim()).filter(Boolean);
      if (colors.length > 0) {
        where.color = { in: colors };
      }
    }

    let categories = await prisma.category.findMany({
      where,
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });

    // Post-filter by product count (_count is computed, can't filter in where)
    const parsedMinProducts = minProducts ? parseInt(minProducts as string, 10) : NaN;
    const parsedMaxProducts = maxProducts ? parseInt(maxProducts as string, 10) : NaN;
    if (!isNaN(parsedMinProducts) && parsedMinProducts > 0) {
      categories = categories.filter(c => ((c as any)._count?.products || 0) >= parsedMinProducts);
    }
    if (!isNaN(parsedMaxProducts) && parsedMaxProducts > 0) {
      categories = categories.filter(c => ((c as any)._count?.products || 0) <= parsedMaxProducts);
    }

    res.json({ categories });
  } catch (error) {
    handleError(req, res, error, 'CATEGORY_LIST_FAILED');
  }
};

export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const body = req.body ?? {};
    const v = new Validator();
    const name = v.requiredString(body.name, 'name', { max: NAME_MAX });
    const description = v.optionalString(body.description, 'description', { max: DESCRIPTION_MAX });
    const color = v.optionalString(body.color, 'color', { max: COLOR_MAX });
    v.throwIfAny();

    const category = await prisma.category.create({
      data: {
        userId: req.user.userId,
        name,
        description,
        color: color || '#6B7280',
      },
    });

    res.status(201).json({ category });
  } catch (error: any) {
    if (error?.code === 'P2002') return fail(req, res, 'CATEGORY_ALREADY_EXISTS', { name: String(req.body?.name ?? '').trim() });
    handleError(req, res, error, 'CATEGORY_CREATE_FAILED');
  }
};

export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const categoryId = req.params.categoryId as string;
    const body = req.body ?? {};

    const v = new Validator();
    const name = v.optionalString(body.name, 'name', { max: NAME_MAX });
    const description = body.description !== undefined ? v.optionalString(body.description, 'description', { max: DESCRIPTION_MAX }) : undefined;
    const color = v.optionalString(body.color, 'color', { max: COLOR_MAX });
    v.throwIfAny();

    // Verify ownership
    const existing = await prisma.category.findFirst({
      where: { id: categoryId, userId: req.user.userId },
    });
    if (!existing) return fail(req, res, 'CATEGORY_NOT_FOUND');

    const category = await prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(color && { color }),
      },
    });

    res.json({ category });
  } catch (error: any) {
    if (error?.code === 'P2002') return fail(req, res, 'CATEGORY_ALREADY_EXISTS', { name: String(req.body?.name ?? '').trim() });
    handleError(req, res, error, 'CATEGORY_UPDATE_FAILED');
  }
};

export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const categoryId = req.params.categoryId as string;

    const existing = await prisma.category.findFirst({
      where: { id: categoryId, userId: req.user.userId },
    });
    if (!existing) return fail(req, res, 'CATEGORY_NOT_FOUND');

    // Active products still filed under this category block the deletion
    const productCount = await prisma.product.count({ where: { categoryId, isActive: true } });
    if (productCount > 0) return fail(req, res, 'CATEGORY_IN_USE', { count: productCount });

    await prisma.category.delete({ where: { id: categoryId } });

    res.json({ success: true });
  } catch (error) {
    handleError(req, res, error, 'CATEGORY_DELETE_FAILED');
  }
};

// ============================================================================
// Products
// ============================================================================

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const {
      categoryId, categoryIds, search, lowStock,
      minPrice, maxPrice, minCost, maxCost, minQty, maxQty, isActive,
      minProfit, maxProfit, minMargin, maxMargin,
      sortBy = 'createdAt', sortOrder = 'desc',
    } = req.query;
    const { limit, offset } = pagination(req.query, { limit: 50 });

    const where: any = { userId: req.user.userId, isActive: true };

    // Active/Inactive filter
    if (isActive === 'true') {
      where.isActive = true;
    } else if (isActive === 'false') {
      where.isActive = false;
    }

    // Multi-category filter (CSV) takes precedence over the single categoryId
    if (categoryIds) {
      const ids = String(categoryIds).split(',').map((s) => s.trim()).filter(Boolean);
      if (ids.length > 0) {
        where.categoryId = { in: ids };
      }
    } else if (categoryId) {
      where.categoryId = categoryId as string;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { sku: { contains: search as string } },
        { description: { contains: search as string } },
      ];
    }

    // Price range filters
    const parsedMinPrice = minPrice ? parseFloat(minPrice as string) : NaN;
    const parsedMaxPrice = maxPrice ? parseFloat(maxPrice as string) : NaN;
    if (!isNaN(parsedMinPrice) && parsedMinPrice > 0) {
      where.sellingPrice = { ...(where.sellingPrice || {}), gte: parsedMinPrice };
    }
    if (!isNaN(parsedMaxPrice) && parsedMaxPrice > 0) {
      where.sellingPrice = { ...(where.sellingPrice || {}), lte: parsedMaxPrice };
    }

    // Cost range filters
    const parsedMinCost = minCost ? parseFloat(minCost as string) : NaN;
    const parsedMaxCost = maxCost ? parseFloat(maxCost as string) : NaN;
    if (!isNaN(parsedMinCost) && parsedMinCost > 0) {
      where.costPrice = { ...(where.costPrice || {}), gte: parsedMinCost };
    }
    if (!isNaN(parsedMaxCost) && parsedMaxCost > 0) {
      where.costPrice = { ...(where.costPrice || {}), lte: parsedMaxCost };
    }

    // Quantity range filters
    const parsedMinQty = minQty ? parseInt(minQty as string, 10) : NaN;
    const parsedMaxQty = maxQty ? parseInt(maxQty as string, 10) : NaN;
    if (!isNaN(parsedMinQty) && parsedMinQty > 0) {
      where.quantity = { ...(where.quantity || {}), gte: parsedMinQty };
    }
    if (!isNaN(parsedMaxQty) && parsedMaxQty > 0) {
      where.quantity = { ...(where.quantity || {}), lte: parsedMaxQty };
    }

    // Move lowStock filter into the DB query so pagination works correctly
    if (lowStock === 'true') {
      // Get IDs of low-stock products at the DB level
      const lowStockIds: { id: string }[] = await prisma.$queryRaw`
        SELECT id FROM Product
        WHERE userId = ${req.user.userId} AND isActive = 1 AND quantity <= minQuantity
      `;
      where.id = { in: lowStockIds.map(r => r.id) };
    }

    const hasMarginFilter = minProfit || maxProfit || minMargin || maxMargin;
    const parsedMinProfit = minProfit ? parseFloat(minProfit as string) : -Infinity;
    const parsedMaxProfit = maxProfit ? parseFloat(maxProfit as string) : Infinity;
    const parsedMinMargin = minMargin ? parseFloat(minMargin as string) : -Infinity;
    const parsedMaxMargin = maxMargin ? parseFloat(maxMargin as string) : Infinity;

    const includeClause = {
      category: { select: { id: true, name: true, color: true } },
      unitRef: { select: { id: true, name: true, abbreviation: true } },
      images: { orderBy: { sortOrder: 'asc' as const }, take: 1, where: { isPrimary: true } },
      expenses: { select: { id: true, amount: true, isPerUnit: true, category: true, description: true } },
      // Active variant rows are required by the order/sale variant pickers —
      // without them hasVariants products are unsellable (backend rejects
      // variant-less lines per the P2 stock policy).
      variants: {
        where: { isActive: true },
        select: { id: true, name: true, sku: true, sellingPrice: true, costPrice: true, quantity: true, minQuantity: true, isActive: true },
        orderBy: { name: 'asc' as const },
      },
      _count: { select: { variants: true } },
    };

    // Build sort order
    const allowedSortFields = ['name', 'sku', 'costPrice', 'sellingPrice', 'quantity', 'createdAt'];
    const sortField = allowedSortFields.includes(sortBy as string) ? (sortBy as string) : 'createdAt';
    const sortDir = sortOrder === 'asc' ? 'asc' : 'desc';
    const orderByClause = sortField === 'name'
      ? [{ name: sortDir as 'asc' | 'desc' }]
      : [{ [sortField]: sortDir }, { name: 'asc' as const }];

    if (hasMarginFilter) {
      // Fetch all matching products, compute margins, filter, then paginate in-memory
      const allProducts = await prisma.product.findMany({
        where,
        include: includeClause,
        orderBy: orderByClause,
      });

      const filtered = allProducts.filter((p: any) => {
        const exps = p.expenses || [];
        const fixedTotal = exps.filter((e: any) => !e.isPerUnit).reduce((s: number, e: any) => s + Number(e.amount), 0);
        const perUnitTotal = exps.filter((e: any) => e.isPerUnit).reduce((s: number, e: any) => s + Number(e.amount), 0);
        const qty = p.quantity || 1;
        const expPerUnit = (fixedTotal / qty) + perUnitTotal;
        const trueCost = Number(p.costPrice) + expPerUnit;
        const sellingPrice = Number(p.sellingPrice);
        const netProfit = sellingPrice - trueCost;
        const marginPercent = sellingPrice > 0 ? (netProfit / sellingPrice) * 100 : 0;

        if (netProfit < parsedMinProfit || netProfit > parsedMaxProfit) return false;
        if (marginPercent < parsedMinMargin || marginPercent > parsedMaxMargin) return false;
        return true;
      });

      res.json({ products: filtered.slice(offset, offset + limit), total: filtered.length });
    } else {
      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: includeClause,
          orderBy: orderByClause,
          skip: offset,
          take: limit,
        }),
        prisma.product.count({ where }),
      ]);

      res.json({ products, total });
    }
  } catch (error) {
    handleError(req, res, error, 'PRODUCT_LIST_FAILED');
  }
};

export const getProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const productId = req.params.productId as string;

    const product = await prisma.product.findFirst({
      where: { id: productId, userId: req.user.userId },
      include: {
        category: true,
        unitRef: true,
        images: { orderBy: { sortOrder: 'asc' } },
        variants: { orderBy: { createdAt: 'asc' } },
        stockMovements: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!product) return fail(req, res, 'PRODUCT_NOT_FOUND');

    res.json({ product });
  } catch (error) {
    handleError(req, res, error, 'PRODUCT_FETCH_FAILED');
  }
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const body = req.body ?? {};
    const v = new Validator();
    const trimmedSku = v.requiredString(body.sku, 'sku', { max: SKU_MAX });
    const trimmedName = v.requiredString(body.name, 'name', { max: NAME_MAX });
    const trimmedDesc = v.optionalString(body.description, 'description', { max: DESCRIPTION_MAX });
    const categoryId = v.id(body.categoryId, 'categoryId', false);
    const unitId = v.id(body.unitId, 'unitId', false);
    const unit = v.optionalString(body.unit, 'unit', { max: UNIT_LABEL_MAX });
    const imageUrl = v.optionalString(body.imageUrl, 'imageUrl', { max: URL_MAX });
    const hasVariants = v.boolean(body.hasVariants, 'hasVariants', false);
    // Cost price and selling price are required (> 0) for new products
    const validCostPrice = v.number(body.costPrice, 'costPrice', { positive: true });
    const validSellingPrice = v.number(body.sellingPrice, 'sellingPrice', { positive: true });
    // Quantity required unless product has variants (variants handle their own qty)
    const validQuantity = hasVariants
      ? v.integer(body.quantity, 'quantity', { min: 0, required: false, def: 0 })
      : v.integer(body.quantity, 'quantity', { positive: true });
    const validMinQuantity = v.integer(body.minQuantity, 'minQuantity', { min: 0, required: false, def: 0 });
    if (v.ok && validSellingPrice < validCostPrice) v.add('sellingPrice', 'PRODUCT_SELLING_BELOW_COST');
    v.throwIfAny();

    await assertOwnCategory(categoryId, req.user.userId);
    await assertUsableUnit(unitId, req.user.userId);

    // Wrap product creation and initial stock movement in a single transaction
    const product = await prisma.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: {
          userId: req.user!.userId,
          sku: trimmedSku,
          name: trimmedName,
          description: trimmedDesc,
          categoryId: categoryId || null,
          unitId: unitId || null,
          costPrice: validCostPrice,
          sellingPrice: validSellingPrice,
          quantity: validQuantity,
          minQuantity: validMinQuantity,
          unit: unit || 'piece',
          imageUrl: imageUrl || null,
        },
        include: { category: true, unitRef: true },
      });

      // Create initial stock movement if quantity > 0
      if (validQuantity > 0) {
        await tx.stockMovement.create({
          data: {
            userId: req.user!.userId,
            productId: newProduct.id,
            type: 'in',
            quantity: validQuantity,
            reason: 'Initial stock',
          },
        });
      }

      return newProduct;
    });

    res.status(201).json({ product });
  } catch (error: any) {
    if (error?.code === 'P2002') return fail(req, res, 'PRODUCT_SKU_ALREADY_EXISTS', { sku: String(req.body?.sku ?? '').trim() });
    handleError(req, res, error, 'PRODUCT_CREATE_FAILED');
  }
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const productId = req.params.productId as string;
    const body = req.body ?? {};

    const v = new Validator();
    const sku = v.optionalString(body.sku, 'sku', { max: SKU_MAX });
    const name = v.optionalString(body.name, 'name', { max: NAME_MAX });
    const description = body.description !== undefined ? v.optionalString(body.description, 'description', { max: DESCRIPTION_MAX }) : undefined;
    const categoryId = body.categoryId !== undefined ? v.id(body.categoryId, 'categoryId', false) : undefined;
    const unitId = body.unitId !== undefined ? v.id(body.unitId, 'unitId', false) : undefined;
    const unit = v.optionalString(body.unit, 'unit', { max: UNIT_LABEL_MAX });
    const imageUrl = body.imageUrl !== undefined ? v.optionalString(body.imageUrl, 'imageUrl', { max: URL_MAX }) : undefined;
    const isActive = body.isActive !== undefined ? v.boolean(body.isActive, 'isActive') : undefined;
    const validCostPrice = body.costPrice !== undefined ? v.number(body.costPrice, 'costPrice', { min: 0 }) : undefined;
    const validSellingPrice = body.sellingPrice !== undefined ? v.number(body.sellingPrice, 'sellingPrice', { min: 0 }) : undefined;
    const validMinQuantity = body.minQuantity !== undefined ? v.integer(body.minQuantity, 'minQuantity', { min: 0 }) : undefined;
    v.throwIfAny();

    const existing = await prisma.product.findFirst({
      where: { id: productId, userId: req.user.userId },
    });
    if (!existing) return fail(req, res, 'PRODUCT_NOT_FOUND');

    if (categoryId !== undefined) await assertOwnCategory(categoryId, req.user.userId);
    if (unitId !== undefined) await assertUsableUnit(unitId, req.user.userId);

    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        ...(sku && { sku }),
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(unitId !== undefined && { unitId: unitId || null }),
        ...(validCostPrice !== undefined && { costPrice: validCostPrice }),
        ...(validSellingPrice !== undefined && { sellingPrice: validSellingPrice }),
        ...(validMinQuantity !== undefined && { minQuantity: validMinQuantity }),
        ...(unit && { unit }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { category: true, unitRef: true },
    });

    res.json({ product });
  } catch (error: any) {
    if (error?.code === 'P2002') return fail(req, res, 'PRODUCT_SKU_ALREADY_EXISTS', { sku: String(req.body?.sku ?? '').trim() });
    handleError(req, res, error, 'PRODUCT_UPDATE_FAILED');
  }
};

export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const productId = req.params.productId as string;

    const existing = await prisma.product.findFirst({
      where: { id: productId, userId: req.user.userId },
    });
    if (!existing) return fail(req, res, 'PRODUCT_NOT_FOUND');

    // Clean up associated image files from disk
    const images = await prisma.productImage.findMany({
      where: { productId },
      select: { filename: true },
    });

    for (const img of images) {
      const filePath = path.join(__dirname, '../../uploads/products', img.filename);
      fs.unlink(filePath, () => {}); // Best-effort cleanup
    }

    // Soft delete
    await prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
    });

    res.json({ success: true });
  } catch (error) {
    handleError(req, res, error, 'PRODUCT_DELETE_FAILED');
  }
};

// ============================================================================
// Stock Adjustments
// ============================================================================

export const adjustStock = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const productId = req.params.productId as string;
    const body = req.body ?? {};

    const v = new Validator();
    const type = v.oneOf(body.type, 'type', MOVEMENT_TYPES);
    const numQuantity = v.integer(body.quantity, 'quantity', { min: 0 });
    const reason = v.optionalString(body.reason, 'reason', { max: REASON_MAX });
    const notes = v.optionalString(body.notes, 'notes', { max: MOVEMENT_NOTES_MAX });
    // Zero is only meaningful when setting an absolute level (adjustment)
    if (v.ok && type !== 'adjustment' && numQuantity === 0) v.add('quantity', 'STOCK_QUANTITY_ZERO');
    v.throwIfAny();

    const product = await findOwnProduct(productId, req.user.userId);
    if (product.hasVariants) return fail(req, res, 'PRODUCT_HAS_VARIANTS');

    // Apply the change atomically inside the transaction — no outside-read,
    // so concurrent adjustments can neither oversell nor corrupt the ledger
    // delta. The hasVariants guard is repeated in the where clauses so it
    // cannot go stale between the check above and the write.
    const [updatedProduct, movement] = await prisma.$transaction(async (tx) => {
      let movementQuantity: number;

      if (type === 'in' || type === 'return') {
        const inc = await tx.product.updateMany({
          where: { id: productId, userId: req.user!.userId, hasVariants: false },
          data: { quantity: { increment: numQuantity } },
        });
        if (inc.count === 0) throw new ApiError('PRODUCT_HAS_VARIANTS');
        movementQuantity = numQuantity;
      } else if (type === 'out') {
        const dec = await tx.product.updateMany({
          where: { id: productId, userId: req.user!.userId, hasVariants: false, quantity: { gte: numQuantity } },
          data: { quantity: { decrement: numQuantity } },
        });
        if (dec.count === 0) {
          const current = await tx.product.findUnique({ where: { id: productId }, select: { quantity: true, hasVariants: true } });
          if (current?.hasVariants) throw new ApiError('PRODUCT_HAS_VARIANTS');
          throw new ApiError('STOCK_INSUFFICIENT', { name: product.name, available: current?.quantity ?? 0 });
        }
        movementQuantity = -numQuantity;
      } else {
        // adjustment — set to exact quantity; compute the ledger delta from a
        // locked read (plain findFirst is a non-locking snapshot read on MySQL)
        const rows = await tx.$queryRaw<Array<{ quantity: number }>>`
          SELECT quantity FROM Product
          WHERE id = ${productId} AND userId = ${req.user!.userId} AND hasVariants = 0
          FOR UPDATE
        `;
        if (rows.length === 0) throw new ApiError('PRODUCT_HAS_VARIANTS');
        movementQuantity = numQuantity - Number(rows[0].quantity);
        await tx.product.update({
          where: { id: productId },
          data: { quantity: numQuantity },
        });
      }

      const mv = await tx.stockMovement.create({
        data: {
          userId: req.user!.userId,
          productId,
          type,
          quantity: movementQuantity,
          reason,
          notes,
        },
      });

      const p = await tx.product.findUniqueOrThrow({ where: { id: productId } });

      return [p, mv] as const;
    });

    res.json({ product: updatedProduct, movement });
  } catch (error) {
    handleError(req, res, error, 'STOCK_ADJUST_FAILED');
  }
};

export const getStockMovements = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const q = req.query;
    const { limit, offset } = pagination(q, { limit: 50 });

    const v = new Validator();
    const productId = v.id(q.productId, 'productId', false);
    const type = q.type ? v.oneOf(q.type, 'type', MOVEMENT_TYPES) : null;
    const startDate = v.date(q.startDate, 'startDate');
    const endDate = v.date(q.endDate, 'endDate');
    v.throwIfAny();
    if (startDate && endDate && startDate > endOfDay(endDate)) throw new ApiError('INVALID_DATE_RANGE');

    const where: any = { userId: req.user.userId };
    if (productId) where.productId = productId;
    if (type) where.type = type;

    // Date range filter (endDate is inclusive: extended to the end of that day)
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endOfDay(endDate);
    }

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: { product: { select: { id: true, name: true, sku: true } } },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    res.json({ movements, total });
  } catch (error) {
    handleError(req, res, error, 'STOCK_MOVEMENTS_FAILED');
  }
};

// ============================================================================
// Suppliers
// ============================================================================

export const getSuppliers = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const { search, isActive, minPurchases, maxPurchases, minTotalSpent, maxTotalSpent } = req.query;

    const v = new Validator();
    const startDate = v.date(req.query.startDate, 'startDate');
    const endDate = v.date(req.query.endDate, 'endDate');
    v.throwIfAny();
    if (startDate && endDate && startDate > endOfDay(endDate)) throw new ApiError('INVALID_DATE_RANGE');

    const where: any = { userId: req.user.userId };

    // Status filter (no longer hardcoded to active)
    if (isActive === 'true') {
      where.isActive = true;
    } else if (isActive === 'false') {
      where.isActive = false;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { email: { contains: search as string } },
        { phone: { contains: search as string } },
      ];
    }

    // Date filter on supplier createdAt
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endOfDay(endDate);
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        _count: { select: { purchases: true } },
        purchases: { select: { total: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Compute totalSpent for each supplier
    let result = suppliers.map(s => {
      const totalSpent = s.purchases.reduce((sum, p) => sum + Number(p.total), 0);
      const { purchases, ...rest } = s;
      return { ...rest, totalSpent };
    });

    // Post-filter by purchase count
    const parsedMinPurchases = minPurchases ? parseInt(minPurchases as string, 10) : NaN;
    const parsedMaxPurchases = maxPurchases ? parseInt(maxPurchases as string, 10) : NaN;
    if (!isNaN(parsedMinPurchases) && parsedMinPurchases > 0) {
      result = result.filter(s => ((s as any)._count?.purchases || 0) >= parsedMinPurchases);
    }
    if (!isNaN(parsedMaxPurchases) && parsedMaxPurchases > 0) {
      result = result.filter(s => ((s as any)._count?.purchases || 0) <= parsedMaxPurchases);
    }

    // Post-filter by total spent
    const parsedMinSpent = minTotalSpent ? parseFloat(minTotalSpent as string) : NaN;
    const parsedMaxSpent = maxTotalSpent ? parseFloat(maxTotalSpent as string) : NaN;
    if (!isNaN(parsedMinSpent) && parsedMinSpent > 0) {
      result = result.filter(s => s.totalSpent >= parsedMinSpent);
    }
    if (!isNaN(parsedMaxSpent)) {
      result = result.filter(s => s.totalSpent <= parsedMaxSpent);
    }

    res.json({ suppliers: result });
  } catch (error) {
    handleError(req, res, error, 'SUPPLIER_LIST_FAILED');
  }
};

export const createSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const body = req.body ?? {};
    const v = new Validator();
    const name = v.requiredString(body.name, 'name', { max: NAME_MAX });
    const email = v.email(body.email, 'email', false);
    const phone = v.optionalString(body.phone, 'phone', { max: PHONE_MAX });
    const address = v.optionalString(body.address, 'address', { max: ADDRESS_MAX });
    const notes = v.optionalString(body.notes, 'notes', { max: NOTES_MAX });
    v.throwIfAny();

    const supplier = await prisma.supplier.create({
      data: {
        userId: req.user.userId,
        name,
        email,
        phone,
        address,
        notes,
      },
    });

    res.status(201).json({ supplier });
  } catch (error: any) {
    if (error?.code === 'P2002') return fail(req, res, 'SUPPLIER_ALREADY_EXISTS', { name: String(req.body?.name ?? '').trim() });
    handleError(req, res, error, 'SUPPLIER_CREATE_FAILED');
  }
};

export const updateSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const supplierId = req.params.supplierId as string;
    const body = req.body ?? {};

    const v = new Validator();
    const name = v.optionalString(body.name, 'name', { max: NAME_MAX });
    const email = body.email !== undefined ? v.email(body.email, 'email', false) : undefined;
    const phone = body.phone !== undefined ? v.optionalString(body.phone, 'phone', { max: PHONE_MAX }) : undefined;
    const address = body.address !== undefined ? v.optionalString(body.address, 'address', { max: ADDRESS_MAX }) : undefined;
    const notes = body.notes !== undefined ? v.optionalString(body.notes, 'notes', { max: NOTES_MAX }) : undefined;
    const isActive = body.isActive !== undefined ? v.boolean(body.isActive, 'isActive') : undefined;
    v.throwIfAny();

    const existing = await prisma.supplier.findFirst({
      where: { id: supplierId, userId: req.user.userId },
    });
    if (!existing) return fail(req, res, 'SUPPLIER_NOT_FOUND');

    const supplier = await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        ...(name && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(notes !== undefined && { notes }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json({ supplier });
  } catch (error: any) {
    if (error?.code === 'P2002') return fail(req, res, 'SUPPLIER_ALREADY_EXISTS', { name: String(req.body?.name ?? '').trim() });
    handleError(req, res, error, 'SUPPLIER_UPDATE_FAILED');
  }
};

export const deleteSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const supplierId = req.params.supplierId as string;

    const existing = await prisma.supplier.findFirst({
      where: { id: supplierId, userId: req.user.userId },
    });
    if (!existing) return fail(req, res, 'SUPPLIER_NOT_FOUND');

    await prisma.supplier.update({
      where: { id: supplierId },
      data: { isActive: false },
    });

    res.json({ success: true });
  } catch (error) {
    handleError(req, res, error, 'SUPPLIER_DELETE_FAILED');
  }
};

// ============================================================================
// Dashboard / Stats
// ============================================================================

export const getStockDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const activeWhere = { userId: req.user.userId, isActive: true };

    const [
      totalProducts,
      totalCategories,
      totalSuppliers,
      recentMovements,
      productStats,
      lowStockCount,
      plainValueStats,
      variantValueStats,
    ] = await Promise.all([
      prisma.product.count({ where: activeWhere }),
      prisma.category.count({ where: { userId: req.user.userId } }),
      prisma.supplier.count({ where: { userId: req.user.userId, isActive: true } }),
      prisma.stockMovement.findMany({
        where: { userId: req.user.userId },
        include: { product: { select: { name: true, sku: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.product.aggregate({
        where: activeWhere,
        _sum: { quantity: true },
      }),
      // Low stock count at DB level
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM Product
        WHERE userId = ${req.user.userId} AND isActive = 1 AND quantity <= minQuantity
      `,
      // Stock & retail value — variant-less products at parent qty × parent prices
      prisma.$queryRaw<[{ stockValue: number; retailValue: number }]>`
        SELECT
          COALESCE(SUM(quantity * costPrice), 0) as stockValue,
          COALESCE(SUM(quantity * sellingPrice), 0) as retailValue
        FROM Product
        WHERE userId = ${req.user.userId} AND isActive = 1 AND hasVariants = 0
      `,
      // Variant products valued per active variant (variant qty × variant prices)
      prisma.$queryRaw<[{ stockValue: number; retailValue: number }]>`
        SELECT
          COALESCE(SUM(v.quantity * v.costPrice), 0) as stockValue,
          COALESCE(SUM(v.quantity * v.sellingPrice), 0) as retailValue
        FROM ProductVariant v
        JOIN Product p ON p.id = v.productId
        WHERE p.userId = ${req.user.userId} AND p.isActive = 1 AND p.hasVariants = 1 AND v.isActive = 1
      `,
    ]);

    res.json({
      stats: {
        totalProducts,
        lowStockProducts: Number(lowStockCount[0]?.count ?? 0),
        totalCategories,
        totalSuppliers,
        totalStockValue:
          Number(plainValueStats[0]?.stockValue ?? 0) + Number(variantValueStats[0]?.stockValue ?? 0),
        totalRetailValue:
          Number(plainValueStats[0]?.retailValue ?? 0) + Number(variantValueStats[0]?.retailValue ?? 0),
        totalItems: productStats._sum.quantity || 0,
      },
      recentMovements,
    });
  } catch (error) {
    handleError(req, res, error, 'STOCK_DASHBOARD_FAILED');
  }
};

// ============================================================================
// Product Expenses
// ============================================================================

export const getProductExpenses = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const productId = req.params.productId as string;
    await findOwnProduct(productId, req.user.userId);

    const expenses = await prisma.productExpense.findMany({
      where: { productId, userId: req.user.userId },
      orderBy: { date: 'desc' },
    });

    res.json({ expenses });
  } catch (error) {
    handleError(req, res, error, 'EXPENSE_LIST_FAILED');
  }
};

export const getProductMargins = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const productId = req.params.productId as string;
    const product = await findOwnProduct(productId, req.user.userId);

    const expenses = await prisma.productExpense.findMany({
      where: { productId, userId: req.user.userId },
    });

    const costPrice = Number(product.costPrice);
    const sellingPrice = Number(product.sellingPrice);
    const quantity = product.quantity || 1; // avoid division by zero

    let fixedTotal = 0;
    let perUnitTotal = 0;
    for (const exp of expenses) {
      if (exp.isPerUnit) {
        perUnitTotal += Number(exp.amount);
      } else {
        fixedTotal += Number(exp.amount);
      }
    }

    const expensePerUnit = (fixedTotal / quantity) + perUnitTotal;
    const trueCost = costPrice + expensePerUnit;
    const netMargin = sellingPrice - trueCost;
    const marginPercent = sellingPrice > 0 ? (netMargin / sellingPrice) * 100 : 0;

    res.json({
      margins: {
        costPrice,
        sellingPrice,
        totalExpenses: fixedTotal + (perUnitTotal * quantity),
        expensePerUnit,
        trueCost,
        netMargin,
        marginPercent,
      },
    });
  } catch (error) {
    handleError(req, res, error, 'PRODUCT_MARGINS_FAILED');
  }
};

export const createProductExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const productId = req.params.productId as string;
    const body = req.body ?? {};

    const v = new Validator();
    const category = v.oneOf(body.category, 'category', VALID_EXPENSE_CATEGORIES);
    const description = v.optionalString(body.description, 'description', { max: EXPENSE_DESCRIPTION_MAX });
    const amount = v.number(body.amount, 'amount', { positive: true });
    const isPerUnit = v.boolean(body.isPerUnit, 'isPerUnit', false);
    const date = v.date(body.date, 'date');
    v.throwIfAny();

    await findOwnProduct(productId, req.user.userId);

    const expense = await prisma.productExpense.create({
      data: {
        userId: req.user.userId,
        productId,
        category,
        description,
        amount,
        isPerUnit,
        date: date ?? new Date(),
      },
    });

    res.status(201).json({ expense });
  } catch (error) {
    handleError(req, res, error, 'EXPENSE_CREATE_FAILED');
  }
};

export const updateProductExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const productId = req.params.productId as string;
    const expenseId = req.params.expenseId as string;
    const body = req.body ?? {};

    const v = new Validator();
    const category = body.category !== undefined && body.category !== null && body.category !== ''
      ? v.oneOf(body.category, 'category', VALID_EXPENSE_CATEGORIES)
      : undefined;
    const description = body.description !== undefined ? v.optionalString(body.description, 'description', { max: EXPENSE_DESCRIPTION_MAX }) : undefined;
    const amount = body.amount !== undefined ? v.number(body.amount, 'amount', { positive: true }) : undefined;
    const isPerUnit = body.isPerUnit !== undefined ? v.boolean(body.isPerUnit, 'isPerUnit') : undefined;
    const date = body.date !== undefined ? v.date(body.date, 'date', { required: true }) : undefined;
    v.throwIfAny();

    const existing = await prisma.productExpense.findFirst({
      where: { id: expenseId, productId, userId: req.user.userId },
    });
    if (!existing) return fail(req, res, 'EXPENSE_NOT_FOUND');

    const expense = await prisma.productExpense.update({
      where: { id: expenseId },
      data: {
        ...(category !== undefined && { category }),
        ...(description !== undefined && { description }),
        ...(amount !== undefined && { amount }),
        ...(isPerUnit !== undefined && { isPerUnit }),
        ...(date && { date }),
      },
    });

    res.json({ expense });
  } catch (error) {
    handleError(req, res, error, 'EXPENSE_UPDATE_FAILED');
  }
};

export const deleteProductExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const productId = req.params.productId as string;
    const expenseId = req.params.expenseId as string;

    const existing = await prisma.productExpense.findFirst({
      where: { id: expenseId, productId, userId: req.user.userId },
    });
    if (!existing) return fail(req, res, 'EXPENSE_NOT_FOUND');

    await prisma.productExpense.delete({ where: { id: expenseId } });

    res.json({ success: true });
  } catch (error) {
    handleError(req, res, error, 'EXPENSE_DELETE_FAILED');
  }
};

// ============================================================================
// Analyze product image with AI — extract name, description, category, unit
// ============================================================================

export const analyzeProductImageEndpoint = async (req: Request, res: Response): Promise<void> => {
  const file = req.file as Express.Multer.File | undefined;
  const removeTempFile = () => {
    if (file?.path) fs.unlink(file.path, () => {});
  };
  try {
    if (!req.user) {
      removeTempFile();
      return fail(req, res, 'UNAUTHORIZED');
    }
    const userId = req.user.userId;

    if (!file) return fail(req, res, 'FILE_REQUIRED');

    // Read file as base64
    const imageBuffer = fs.readFileSync(file.path);
    const imageBase64 = imageBuffer.toString('base64');
    const mimeType = file.mimetype || 'image/jpeg';

    // Clean up the temp file
    removeTempFile();

    // Fetch user's existing categories and units
    const [categories, units] = await Promise.all([
      prisma.category.findMany({
        where: { userId },
        select: { name: true },
      }),
      prisma.unit.findMany({
        where: { OR: [{ userId }, { userId: null }] },
        select: { name: true },
      }),
    ]);

    const categoryNames = categories.map(c => c.name);
    const unitNames = units.map(u => u.name);

    let result;
    try {
      result = await analyzeProductImage(imageBase64, mimeType, categoryNames, unitNames);
    } catch (aiError: any) {
      if (aiError instanceof ApiError) throw aiError;
      console.error('Analyze product image error:', aiError);
      // No provider / no key configured → 503; the provider answered but unusably → 502
      const msg = String(aiError?.message ?? '');
      const code = /unavailable|not active/i.test(msg) ? 'IMAGE_ANALYSIS_UNAVAILABLE' : 'IMAGE_ANALYSIS_FAILED';
      return fail(req, res, code);
    }

    res.json(result);
  } catch (error) {
    removeTempFile();
    handleError(req, res, error, 'IMAGE_ANALYSIS_FAILED');
  }
};
