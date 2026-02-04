import { Request, Response } from 'express';
import prisma from '../config/database';
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

    const { search } = req.query;
    const where: any = { userId: req.user.userId };

    if (search) {
      where.name = { contains: search as string };
    }

    const categories = await prisma.category.findMany({
      where,
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });

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

    const { categoryId, search, lowStock, limit = '50', offset = '0' } = req.query;

    const where: any = { userId: req.user.userId, isActive: true };

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

    // Move lowStock filter into the DB query so pagination works correctly
    if (lowStock === 'true') {
      // Get IDs of low-stock products at the DB level
      const lowStockIds: { id: string }[] = await prisma.$queryRaw`
        SELECT id FROM Product
        WHERE userId = ${req.user.userId} AND isActive = 1 AND quantity <= minQuantity
      `;
      where.id = { in: lowStockIds.map(r => r.id) };
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, color: true } },
          unitRef: { select: { id: true, name: true, abbreviation: true } },
          images: { orderBy: { sortOrder: 'asc' }, take: 1, where: { isPrimary: true } },
          _count: { select: { variants: true } },
        },
        orderBy: { name: 'asc' },
        skip: parseInt(offset as string, 10),
        take: parseInt(limit as string, 10),
      }),
      prisma.product.count({ where }),
    ]);

    res.json({ products, total });
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

    const { search } = req.query;
    const where: any = { userId: req.user.userId, isActive: true };

    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { email: { contains: search as string } },
        { phone: { contains: search as string } },
      ];
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      include: { _count: { select: { purchases: true } } },
      orderBy: { name: 'asc' },
    });

    res.json({ suppliers });
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
