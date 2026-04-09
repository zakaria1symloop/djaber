import { Request, Response } from 'express';
import prisma from '../config/database';
import { analyzeProductImage } from '../services/ai.service';
import fs from 'fs';
import path from 'path';

// ============================================================================
// Validation helpers
// ============================================================================

function validateNonNegativeNumber(value: any, name: string): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (isNaN(num) || num < 0) throw new Error(`${name} must be a non-negative number`);
  return num;
}

function validateString(value: any, maxLength: number): string | null {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  if (str.length > maxLength) throw new Error(`Value exceeds maximum length of ${maxLength}`);
  return str || null;
}

// User-level stock management - uses userId instead of pageId

// ============================================================================
// Categories
// ============================================================================

export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

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
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, description, color } = req.body;

    const trimmedName = name?.trim();
    if (!trimmedName) {
      res.status(400).json({ error: 'Category name is required' });
      return;
    }
    if (trimmedName.length > 255) {
      res.status(400).json({ error: 'Category name is too long (max 255)' });
      return;
    }

    const category = await prisma.category.create({
      data: {
        userId: req.user.userId,
        name: trimmedName,
        description: description?.trim().slice(0, 5000) || null,
        color: color || '#6B7280',
      },
    });

    res.status(201).json({ category });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Category already exists' });
      return;
    }
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
};

export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const categoryId = req.params.categoryId as string;
    const { name, description, color } = req.body;

    // Verify ownership
    const existing = await prisma.category.findFirst({
      where: { id: categoryId, userId: req.user.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    const category = await prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(color && { color }),
      },
    });

    res.json({ category });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
};

export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const categoryId = req.params.categoryId as string;

    const existing = await prisma.category.findFirst({
      where: { id: categoryId, userId: req.user.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    await prisma.category.delete({ where: { id: categoryId } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
};

// ============================================================================
// Products
// ============================================================================

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      categoryId, search, lowStock, limit = '50', offset = '0',
      minPrice, maxPrice, minCost, maxCost, minQty, maxQty, isActive,
      minProfit, maxProfit, minMargin, maxMargin,
      sortBy = 'createdAt', sortOrder = 'desc',
    } = req.query;

    const where: any = { userId: req.user.userId, isActive: true };

    // Active/Inactive filter
    if (isActive === 'true') {
      where.isActive = true;
    } else if (isActive === 'false') {
      where.isActive = false;
    }

    if (categoryId) {
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

      const skip = parseInt(offset as string, 10);
      const take = parseInt(limit as string, 10);
      res.json({ products: filtered.slice(skip, skip + take), total: filtered.length });
    } else {
      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: includeClause,
          orderBy: orderByClause,
          skip: parseInt(offset as string, 10),
          take: parseInt(limit as string, 10),
        }),
        prisma.product.count({ where }),
      ]);

      res.json({ products, total });
    }
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

export const getProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

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

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.json({ product });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      sku,
      name,
      description,
      categoryId,
      costPrice,
      sellingPrice,
      quantity,
      minQuantity,
      unit,
      unitId,
      imageUrl,
    } = req.body;

    if (!sku?.trim() || !name?.trim()) {
      res.status(400).json({ error: 'SKU and name are required' });
      return;
    }

    // Validate numeric fields
    try {
      var validCostPrice = validateNonNegativeNumber(costPrice, 'costPrice') ?? 0;
      var validSellingPrice = validateNonNegativeNumber(sellingPrice, 'sellingPrice') ?? 0;
      var validQuantity = validateNonNegativeNumber(quantity, 'quantity') ?? 0;
      var validMinQuantity = validateNonNegativeNumber(minQuantity, 'minQuantity') ?? 0;
    } catch (validationErr: any) {
      res.status(400).json({ error: validationErr.message });
      return;
    }

    // Cost price, selling price, and quantity are required for new products
    if (validCostPrice <= 0) {
      res.status(400).json({ error: 'Cost price is required and must be greater than 0' });
      return;
    }
    if (validSellingPrice <= 0) {
      res.status(400).json({ error: 'Selling price is required and must be greater than 0' });
      return;
    }
    if (validSellingPrice < validCostPrice) {
      res.status(400).json({ error: 'Selling price must be greater than or equal to cost price' });
      return;
    }
    // Quantity required unless product has variants (variants handle their own qty)
    const hasVariants = req.body.hasVariants || false;
    if (!hasVariants && validQuantity <= 0) {
      res.status(400).json({ error: 'Initial quantity is required and must be greater than 0' });
      return;
    }

    const trimmedName = validateString(name, 255);
    const trimmedSku = validateString(sku, 255);
    const trimmedDesc = validateString(description, 5000);

    if (!trimmedName || !trimmedSku) {
      res.status(400).json({ error: 'SKU and name are required' });
      return;
    }

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
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'SKU already exists' });
      return;
    }
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const productId = req.params.productId as string;
    const {
      sku,
      name,
      description,
      categoryId,
      costPrice,
      sellingPrice,
      minQuantity,
      unit,
      unitId,
      imageUrl,
      isActive,
    } = req.body;

    const existing = await prisma.product.findFirst({
      where: { id: productId, userId: req.user.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Validate numeric fields
    try {
      var validCostPrice = costPrice !== undefined ? validateNonNegativeNumber(costPrice, 'costPrice') : undefined;
      var validSellingPrice = sellingPrice !== undefined ? validateNonNegativeNumber(sellingPrice, 'sellingPrice') : undefined;
      var validMinQuantity = minQuantity !== undefined ? validateNonNegativeNumber(minQuantity, 'minQuantity') : undefined;
    } catch (validationErr: any) {
      res.status(400).json({ error: validationErr.message });
      return;
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        ...(sku && { sku: sku.trim().slice(0, 255) }),
        ...(name && { name: name.trim().slice(0, 255) }),
        ...(description !== undefined && { description: description?.trim().slice(0, 5000) || null }),
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
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
};

export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const productId = req.params.productId as string;

    const existing = await prisma.product.findFirst({
      where: { id: productId, userId: req.user.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

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
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
};

// ============================================================================
// Stock Adjustments
// ============================================================================

export const adjustStock = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const productId = req.params.productId as string;
    const { type, quantity, reason, notes } = req.body;

    if (!type || !quantity) {
      res.status(400).json({ error: 'Type and quantity are required' });
      return;
    }

    if (!['in', 'out', 'adjustment'].includes(type)) {
      res.status(400).json({ error: 'Invalid type. Must be: in, out, or adjustment' });
      return;
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, userId: req.user.userId },
    });

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    if (product.hasVariants) {
      res.status(400).json({ error: 'This product has variants. Adjust stock at the variant level.' });
      return;
    }

    // Calculate new quantity
    let newQuantity = product.quantity;
    if (type === 'in') {
      newQuantity += quantity;
    } else if (type === 'out') {
      newQuantity -= quantity;
      if (newQuantity < 0) {
        res.status(400).json({ error: 'Insufficient stock' });
        return;
      }
    } else {
      // Adjustment - set to exact quantity
      newQuantity = quantity;
    }

    // Update product and create movement
    const [updatedProduct, movement] = await prisma.$transaction([
      prisma.product.update({
        where: { id: productId },
        data: { quantity: newQuantity },
      }),
      prisma.stockMovement.create({
        data: {
          userId: req.user.userId,
          productId,
          type,
          quantity: type === 'adjustment' ? quantity - product.quantity : (type === 'out' ? -quantity : quantity),
          reason,
          notes,
        },
      }),
    ]);

    res.json({ product: updatedProduct, movement });
  } catch (error) {
    console.error('Adjust stock error:', error);
    res.status(500).json({ error: 'Failed to adjust stock' });
  }
};

export const getStockMovements = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { productId, type, startDate, endDate, limit = '50', offset = '0' } = req.query;

    const where: any = { userId: req.user.userId };
    if (productId) where.productId = productId as string;
    if (type) where.type = type as string;

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: { product: { select: { id: true, name: true, sku: true } } },
        orderBy: { createdAt: 'desc' },
        skip: parseInt(offset as string, 10),
        take: parseInt(limit as string, 10),
      }),
      prisma.stockMovement.count({ where }),
    ]);

    res.json({ movements, total });
  } catch (error) {
    console.error('Get stock movements error:', error);
    res.status(500).json({ error: 'Failed to fetch stock movements' });
  }
};

// ============================================================================
// Suppliers
// ============================================================================

export const getSuppliers = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { search, isActive, minPurchases, maxPurchases, minTotalSpent, maxTotalSpent, startDate, endDate } = req.query;
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
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
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
    console.error('Get suppliers error:', error);
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
};

export const createSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, email, phone, address, notes } = req.body;

    const trimmedName = name?.trim();
    if (!trimmedName) {
      res.status(400).json({ error: 'Supplier name is required' });
      return;
    }
    if (trimmedName.length > 255) {
      res.status(400).json({ error: 'Supplier name is too long (max 255)' });
      return;
    }

    const supplier = await prisma.supplier.create({
      data: {
        userId: req.user.userId,
        name: trimmedName,
        email: email?.trim().slice(0, 255) || null,
        phone: phone?.trim().slice(0, 50) || null,
        address: address?.trim().slice(0, 1000) || null,
        notes: notes?.trim().slice(0, 5000) || null,
      },
    });

    res.status(201).json({ supplier });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Supplier already exists' });
      return;
    }
    console.error('Create supplier error:', error);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
};

export const updateSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const supplierId = req.params.supplierId as string;
    const { name, email, phone, address, notes, isActive } = req.body;

    const existing = await prisma.supplier.findFirst({
      where: { id: supplierId, userId: req.user.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }

    const supplier = await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        ...(name && { name: name.trim() }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(address !== undefined && { address: address?.trim() || null }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json({ supplier });
  } catch (error) {
    console.error('Update supplier error:', error);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
};

export const deleteSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const supplierId = req.params.supplierId as string;

    const existing = await prisma.supplier.findFirst({
      where: { id: supplierId, userId: req.user.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }

    await prisma.supplier.update({
      where: { id: supplierId },
      data: { isActive: false },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete supplier error:', error);
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
};

// ============================================================================
// Dashboard / Stats
// ============================================================================

export const getStockDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const activeWhere = { userId: req.user.userId, isActive: true };

    const [
      totalProducts,
      totalCategories,
      totalSuppliers,
      recentMovements,
      productStats,
      lowStockCount,
      valueStats,
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
      // Stock & retail value at DB level
      prisma.$queryRaw<[{ stockValue: number; retailValue: number }]>`
        SELECT
          COALESCE(SUM(quantity * costPrice), 0) as stockValue,
          COALESCE(SUM(quantity * sellingPrice), 0) as retailValue
        FROM Product
        WHERE userId = ${req.user.userId} AND isActive = 1
      `,
    ]);

    res.json({
      stats: {
        totalProducts,
        lowStockProducts: Number(lowStockCount[0]?.count ?? 0),
        totalCategories,
        totalSuppliers,
        totalStockValue: Number(valueStats[0]?.stockValue ?? 0),
        totalRetailValue: Number(valueStats[0]?.retailValue ?? 0),
        totalItems: productStats._sum.quantity || 0,
      },
      recentMovements,
    });
  } catch (error) {
    console.error('Get stock dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};

// ============================================================================
// Product Expenses
// ============================================================================

const VALID_EXPENSE_CATEGORIES = ['marketing', 'shipping', 'packaging', 'customs', 'storage', 'other'];

export const getProductExpenses = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const productId = req.params.productId as string;

    // Verify ownership
    const product = await prisma.product.findFirst({
      where: { id: productId, userId: req.user.userId },
    });
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const expenses = await prisma.productExpense.findMany({
      where: { productId, userId: req.user.userId },
      orderBy: { date: 'desc' },
    });

    res.json({ expenses });
  } catch (error) {
    console.error('Get product expenses error:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
};

export const getProductMargins = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const productId = req.params.productId as string;

    const product = await prisma.product.findFirst({
      where: { id: productId, userId: req.user.userId },
    });
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

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
    console.error('Get product margins error:', error);
    res.status(500).json({ error: 'Failed to calculate margins' });
  }
};

export const createProductExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const productId = req.params.productId as string;
    const { category, description, amount, isPerUnit, date } = req.body;

    const product = await prisma.product.findFirst({
      where: { id: productId, userId: req.user.userId },
    });
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    if (!category || !VALID_EXPENSE_CATEGORIES.includes(category)) {
      res.status(400).json({ error: `Category must be one of: ${VALID_EXPENSE_CATEGORIES.join(', ')}` });
      return;
    }
    if (!amount || Number(amount) <= 0) {
      res.status(400).json({ error: 'Amount must be a positive number' });
      return;
    }

    const expense = await prisma.productExpense.create({
      data: {
        userId: req.user.userId,
        productId,
        category,
        description: description?.trim() || null,
        amount: Number(amount),
        isPerUnit: !!isPerUnit,
        date: date ? new Date(date) : new Date(),
      },
    });

    res.status(201).json({ expense });
  } catch (error) {
    console.error('Create product expense error:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
};

export const updateProductExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const productId = req.params.productId as string;
    const expenseId = req.params.expenseId as string;
    const { category, description, amount, isPerUnit, date } = req.body;

    const existing = await prisma.productExpense.findFirst({
      where: { id: expenseId, productId, userId: req.user.userId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    const expense = await prisma.productExpense.update({
      where: { id: expenseId },
      data: {
        ...(category && VALID_EXPENSE_CATEGORIES.includes(category) && { category }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(amount !== undefined && { amount: Number(amount) }),
        ...(isPerUnit !== undefined && { isPerUnit: !!isPerUnit }),
        ...(date !== undefined && { date: new Date(date) }),
      },
    });

    res.json({ expense });
  } catch (error) {
    console.error('Update product expense error:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
};

export const deleteProductExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const productId = req.params.productId as string;
    const expenseId = req.params.expenseId as string;

    const existing = await prisma.productExpense.findFirst({
      where: { id: expenseId, productId, userId: req.user.userId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    await prisma.productExpense.delete({ where: { id: expenseId } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete product expense error:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
};

// ============================================================================
// Analyze product image with AI — extract name, description, category, unit
// ============================================================================

export const analyzeProductImageEndpoint = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const file = (req as any).file;

    if (!file) {
      res.status(400).json({ error: 'No image file provided' });
      return;
    }

    // Read file as base64
    const filePath = file.path;
    const imageBuffer = fs.readFileSync(filePath);
    const imageBase64 = imageBuffer.toString('base64');
    const mimeType = file.mimetype || 'image/jpeg';

    // Clean up the temp file
    try { fs.unlinkSync(filePath); } catch {}

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

    const result = await analyzeProductImage(imageBase64, mimeType, categoryNames, unitNames);

    res.json(result);
  } catch (error: any) {
    console.error('Analyze product image error:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze image' });
  }
};
