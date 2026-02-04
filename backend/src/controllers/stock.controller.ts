import { Request, Response } from 'express';
import prisma from '../config/database';

// ============================================================================
// Categories
// ============================================================================

export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const pageId = req.params.pageId as string;

    // Verify page ownership
    const page = await prisma.page.findFirst({
      where: { id: pageId, userId: req.user.userId, isActive: true },
    });

    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }

    const categories = await prisma.category.findMany({
      where: { pageId },
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

    const pageId = req.params.pageId as string;
    const { name, description, color } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ error: 'Category name is required' });
      return;
    }

    const page = await prisma.page.findFirst({
      where: { id: pageId, userId: req.user.userId, isActive: true },
    });

    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }

    const category = await prisma.category.create({
      data: {
        pageId,
        name: name.trim(),
        description: description?.trim() || null,
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

    const pageId = req.params.pageId as string;
    const categoryId = req.params.categoryId as string;
    const { name, description, color } = req.body;

    const page = await prisma.page.findFirst({
      where: { id: pageId, userId: req.user.userId, isActive: true },
    });

    if (!page) {
      res.status(404).json({ error: 'Page not found' });
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

    const pageId = req.params.pageId as string;
    const categoryId = req.params.categoryId as string;

    const page = await prisma.page.findFirst({
      where: { id: pageId, userId: req.user.userId, isActive: true },
    });

    if (!page) {
      res.status(404).json({ error: 'Page not found' });
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

    const pageId = req.params.pageId as string;
    const { categoryId, search, lowStock, limit = '50', offset = '0' } = req.query;

    const page = await prisma.page.findFirst({
      where: { id: pageId, userId: req.user.userId, isActive: true },
    });

    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }

    const where: any = { pageId, isActive: true };

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

    let [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: { select: { id: true, name: true, color: true } } },
        orderBy: { name: 'asc' },
        skip: parseInt(offset as string, 10),
        take: parseInt(limit as string, 10),
      }),
      prisma.product.count({ where }),
    ]);

    // Filter low stock products in-memory if requested
    if (lowStock === 'true') {
      products = products.filter(p => p.quantity <= p.minQuantity);
      total = products.length;
    }

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

    const pageId = req.params.pageId as string;
    const productId = req.params.productId as string;

    const page = await prisma.page.findFirst({
      where: { id: pageId, userId: req.user.userId, isActive: true },
    });

    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, pageId },
      include: {
        category: true,
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

    const pageId = req.params.pageId as string;
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
      imageUrl,
    } = req.body;

    if (!sku?.trim() || !name?.trim()) {
      res.status(400).json({ error: 'SKU and name are required' });
      return;
    }

    const page = await prisma.page.findFirst({
      where: { id: pageId, userId: req.user.userId, isActive: true },
    });

    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }

    const product = await prisma.product.create({
      data: {
        pageId,
        sku: sku.trim(),
        name: name.trim(),
        description: description?.trim() || null,
        categoryId: categoryId || null,
        costPrice: costPrice || 0,
        sellingPrice: sellingPrice || 0,
        quantity: quantity || 0,
        minQuantity: minQuantity || 0,
        unit: unit || 'piece',
        imageUrl: imageUrl || null,
      },
      include: { category: true },
    });

    // Create initial stock movement if quantity > 0
    if (quantity > 0) {
      await prisma.stockMovement.create({
        data: {
          pageId,
          productId: product.id,
          type: 'in',
          quantity,
          reason: 'Initial stock',
        },
      });
    }

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

    const pageId = req.params.pageId as string;
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
      imageUrl,
      isActive,
    } = req.body;

    const page = await prisma.page.findFirst({
      where: { id: pageId, userId: req.user.userId, isActive: true },
    });

    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        ...(sku && { sku: sku.trim() }),
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(costPrice !== undefined && { costPrice }),
        ...(sellingPrice !== undefined && { sellingPrice }),
        ...(minQuantity !== undefined && { minQuantity }),
        ...(unit && { unit }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { category: true },
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

    const pageId = req.params.pageId as string;
    const productId = req.params.productId as string;

    const page = await prisma.page.findFirst({
      where: { id: pageId, userId: req.user.userId, isActive: true },
    });

    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
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

    const pageId = req.params.pageId as string;
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

    const page = await prisma.page.findFirst({
      where: { id: pageId, userId: req.user.userId, isActive: true },
    });

    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, pageId },
    });

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
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
          pageId,
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

    const pageId = req.params.pageId as string;
    const { productId, type, limit = '50', offset = '0' } = req.query;

    const page = await prisma.page.findFirst({
      where: { id: pageId, userId: req.user.userId, isActive: true },
    });

    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }

    const where: any = { pageId };
    if (productId) where.productId = productId as string;
    if (type) where.type = type as string;

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

    const pageId = req.params.pageId as string;

    const page = await prisma.page.findFirst({
      where: { id: pageId, userId: req.user.userId, isActive: true },
    });

    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }

    const suppliers = await prisma.supplier.findMany({
      where: { pageId, isActive: true },
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

    const pageId = req.params.pageId as string;
    const { name, email, phone, address, notes } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ error: 'Supplier name is required' });
      return;
    }

    const page = await prisma.page.findFirst({
      where: { id: pageId, userId: req.user.userId, isActive: true },
    });

    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }

    const supplier = await prisma.supplier.create({
      data: {
        pageId,
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        notes: notes?.trim() || null,
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

    const pageId = req.params.pageId as string;
    const supplierId = req.params.supplierId as string;
    const { name, email, phone, address, notes, isActive } = req.body;

    const page = await prisma.page.findFirst({
      where: { id: pageId, userId: req.user.userId, isActive: true },
    });

    if (!page) {
      res.status(404).json({ error: 'Page not found' });
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

    const pageId = req.params.pageId as string;
    const supplierId = req.params.supplierId as string;

    const page = await prisma.page.findFirst({
      where: { id: pageId, userId: req.user.userId, isActive: true },
    });

    if (!page) {
      res.status(404).json({ error: 'Page not found' });
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

    const pageId = req.params.pageId as string;

    const page = await prisma.page.findFirst({
      where: { id: pageId, userId: req.user.userId, isActive: true },
    });

    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }

    // Get stats
    const [
      totalProducts,
      totalCategories,
      totalSuppliers,
      recentMovements,
      productStats,
      allProducts,
    ] = await Promise.all([
      prisma.product.count({ where: { pageId, isActive: true } }),
      prisma.category.count({ where: { pageId } }),
      prisma.supplier.count({ where: { pageId, isActive: true } }),
      prisma.stockMovement.findMany({
        where: { pageId },
        include: { product: { select: { name: true, sku: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.product.aggregate({
        where: { pageId, isActive: true },
        _sum: { quantity: true },
        _avg: { sellingPrice: true, costPrice: true },
      }),
      prisma.product.findMany({
        where: { pageId, isActive: true },
        select: { quantity: true, minQuantity: true, costPrice: true, sellingPrice: true },
      }),
    ]);

    // Calculate low stock count by comparing quantity with minQuantity
    const lowStockProducts = allProducts.filter(p => p.quantity <= p.minQuantity).length;

    // Calculate total stock value using allProducts (already fetched)
    const totalStockValue = allProducts.reduce(
      (sum, p) => sum + p.quantity * Number(p.costPrice),
      0
    );
    const totalRetailValue = allProducts.reduce(
      (sum, p) => sum + p.quantity * Number(p.sellingPrice),
      0
    );

    res.json({
      stats: {
        totalProducts,
        lowStockProducts,
        totalCategories,
        totalSuppliers,
        totalStockValue,
        totalRetailValue,
        totalItems: productStats._sum.quantity || 0,
      },
      recentMovements,
    });
  } catch (error) {
    console.error('Get stock dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};
