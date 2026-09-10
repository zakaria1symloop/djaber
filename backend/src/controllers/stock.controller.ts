import { Request, Response } from 'express';
import prisma from '../config/database';
import { ApiError, fail, handleError } from '../errors';
import { Validator, pagination } from '../middleware/validate';

const MOVEMENT_TYPES = ['in', 'out', 'adjustment'] as const;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Legacy per-page API: every resource hangs off a page the caller owns.
 * Returns the page or throws PAGE_NOT_FOUND (404) — never leaks whether the
 * page exists for someone else.
 */
export const ownedPage = async (req: Request, pageId: string) => {
  if (!req.user) throw new ApiError('UNAUTHORIZED');
  const page = await prisma.page.findFirst({
    where: { id: pageId, userId: req.user.userId, isActive: true },
    select: { id: true },
  });
  if (!page) throw new ApiError('PAGE_NOT_FOUND');
  return page;
};

// ============================================================================
// Categories
// ============================================================================

export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const pageId = req.params.pageId as string;
    await ownedPage(req, pageId);

    const categories = await prisma.category.findMany({
      where: { pageId },
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });

    res.json({ categories });
  } catch (error) {
    return handleError(req, res, error, 'LEGACY_CATEGORY_LIST_FAILED');
  }
};

export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const pageId = req.params.pageId as string;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const v = new Validator();
    const name = v.requiredString(body.name, 'name', { max: 100 });
    const description = v.optionalString(body.description, 'description', { max: 1000 });
    const color = v.optionalString(body.color, 'color', { max: 7 }) ?? '#6B7280';
    if (!COLOR_RE.test(color)) v.add('color', 'FIELD_INVALID');
    v.throwIfAny();

    await ownedPage(req, pageId);

    const existing = await prisma.category.findFirst({ where: { pageId, name }, select: { id: true } });
    if (existing) return fail(req, res, 'LEGACY_CATEGORY_EXISTS');

    const category = await prisma.category.create({
      data: { pageId, name, description, color },
    });

    res.status(201).json({ category });
  } catch (error) {
    return handleError(req, res, error, 'LEGACY_CATEGORY_CREATE_FAILED');
  }
};

export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const pageId = req.params.pageId as string;
    const categoryId = req.params.categoryId as string;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const v = new Validator();
    const name = body.name === undefined || body.name === null ? undefined : v.requiredString(body.name, 'name', { max: 100 });
    const description = body.description === undefined ? undefined : v.optionalString(body.description, 'description', { max: 1000 });
    const color = body.color === undefined || body.color === null || body.color === '' ? undefined : v.requiredString(body.color, 'color', { max: 7 });
    if (color && !COLOR_RE.test(color)) v.add('color', 'FIELD_INVALID');
    v.throwIfAny();

    await ownedPage(req, pageId);

    // IDOR guard: the category must belong to this page
    const existing = await prisma.category.findFirst({ where: { id: categoryId, pageId }, select: { id: true } });
    if (!existing) return fail(req, res, 'CATEGORY_NOT_FOUND');

    if (name) {
      const clash = await prisma.category.findFirst({ where: { pageId, name, id: { not: categoryId } }, select: { id: true } });
      if (clash) return fail(req, res, 'LEGACY_CATEGORY_EXISTS');
    }

    const category = await prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(color && { color }),
      },
    });

    res.json({ category });
  } catch (error) {
    return handleError(req, res, error, 'LEGACY_CATEGORY_UPDATE_FAILED');
  }
};

export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const pageId = req.params.pageId as string;
    const categoryId = req.params.categoryId as string;

    await ownedPage(req, pageId);

    const existing = await prisma.category.findFirst({ where: { id: categoryId, pageId }, select: { id: true } });
    if (!existing) return fail(req, res, 'CATEGORY_NOT_FOUND');

    await prisma.category.delete({ where: { id: categoryId } });

    res.json({ success: true });
  } catch (error) {
    return handleError(req, res, error, 'LEGACY_CATEGORY_DELETE_FAILED');
  }
};

// ============================================================================
// Products
// ============================================================================

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const pageId = req.params.pageId as string;
    const { categoryId, search, lowStock } = req.query;
    const { limit, offset } = pagination(req.query);

    await ownedPage(req, pageId);

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
        skip: offset,
        take: limit,
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
    return handleError(req, res, error, 'LEGACY_PRODUCT_LIST_FAILED');
  }
};

export const getProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const pageId = req.params.pageId as string;
    const productId = req.params.productId as string;

    await ownedPage(req, pageId);

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

    if (!product) return fail(req, res, 'PRODUCT_NOT_FOUND');

    res.json({ product });
  } catch (error) {
    return handleError(req, res, error, 'LEGACY_PRODUCT_FETCH_FAILED');
  }
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const pageId = req.params.pageId as string;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const v = new Validator();
    const sku = v.requiredString(body.sku, 'sku', { max: 100 });
    const name = v.requiredString(body.name, 'name', { max: 200 });
    const description = v.optionalString(body.description, 'description', { max: 5000 });
    const categoryId = v.optionalString(body.categoryId, 'categoryId', { max: 64 });
    const costPrice = v.number(body.costPrice, 'costPrice', { required: false, def: 0, min: 0 });
    const sellingPrice = v.number(body.sellingPrice, 'sellingPrice', { required: false, def: 0, min: 0 });
    const quantity = v.integer(body.quantity, 'quantity', { required: false, def: 0, min: 0 });
    const minQuantity = v.integer(body.minQuantity, 'minQuantity', { required: false, def: 0, min: 0 });
    const unit = v.optionalString(body.unit, 'unit', { max: 50 }) ?? 'piece';
    const imageUrl = v.optionalString(body.imageUrl, 'imageUrl', { max: 2000 });
    v.throwIfAny();

    await ownedPage(req, pageId);

    if (categoryId) {
      const category = await prisma.category.findFirst({ where: { id: categoryId, pageId }, select: { id: true } });
      if (!category) return fail(req, res, 'CATEGORY_NOT_FOUND');
    }

    const skuClash = await prisma.product.findFirst({ where: { pageId, sku }, select: { id: true } });
    if (skuClash) return fail(req, res, 'LEGACY_SKU_EXISTS');

    const product = await prisma.product.create({
      data: {
        pageId,
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
  } catch (error) {
    return handleError(req, res, error, 'LEGACY_PRODUCT_CREATE_FAILED');
  }
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const pageId = req.params.pageId as string;
    const productId = req.params.productId as string;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const has = (k: string) => body[k] !== undefined && body[k] !== null && body[k] !== '';

    const v = new Validator();
    const sku = has('sku') ? v.requiredString(body.sku, 'sku', { max: 100 }) : undefined;
    const name = has('name') ? v.requiredString(body.name, 'name', { max: 200 }) : undefined;
    const description = body.description === undefined ? undefined : v.optionalString(body.description, 'description', { max: 5000 });
    const categoryId = body.categoryId === undefined ? undefined : v.optionalString(body.categoryId, 'categoryId', { max: 64 });
    const costPrice = body.costPrice === undefined ? undefined : v.number(body.costPrice, 'costPrice', { min: 0 });
    const sellingPrice = body.sellingPrice === undefined ? undefined : v.number(body.sellingPrice, 'sellingPrice', { min: 0 });
    const minQuantity = body.minQuantity === undefined ? undefined : v.integer(body.minQuantity, 'minQuantity', { min: 0 });
    const unit = has('unit') ? v.requiredString(body.unit, 'unit', { max: 50 }) : undefined;
    const imageUrl = body.imageUrl === undefined ? undefined : v.optionalString(body.imageUrl, 'imageUrl', { max: 2000 });
    const isActive = body.isActive === undefined || body.isActive === null ? undefined : v.boolean(body.isActive, 'isActive');
    v.throwIfAny();

    await ownedPage(req, pageId);

    // IDOR guard: the product must belong to this page
    const existing = await prisma.product.findFirst({ where: { id: productId, pageId }, select: { id: true } });
    if (!existing) return fail(req, res, 'PRODUCT_NOT_FOUND');

    if (categoryId) {
      const category = await prisma.category.findFirst({ where: { id: categoryId, pageId }, select: { id: true } });
      if (!category) return fail(req, res, 'CATEGORY_NOT_FOUND');
    }

    if (sku) {
      const clash = await prisma.product.findFirst({ where: { pageId, sku, id: { not: productId } }, select: { id: true } });
      if (clash) return fail(req, res, 'LEGACY_SKU_EXISTS');
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        ...(sku && { sku }),
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(categoryId !== undefined && { categoryId }),
        ...(costPrice !== undefined && { costPrice }),
        ...(sellingPrice !== undefined && { sellingPrice }),
        ...(minQuantity !== undefined && { minQuantity }),
        ...(unit && { unit }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { category: true },
    });

    res.json({ product });
  } catch (error) {
    return handleError(req, res, error, 'LEGACY_PRODUCT_UPDATE_FAILED');
  }
};

export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const pageId = req.params.pageId as string;
    const productId = req.params.productId as string;

    await ownedPage(req, pageId);

    const existing = await prisma.product.findFirst({ where: { id: productId, pageId }, select: { id: true } });
    if (!existing) return fail(req, res, 'PRODUCT_NOT_FOUND');

    // Soft delete
    await prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
    });

    res.json({ success: true });
  } catch (error) {
    return handleError(req, res, error, 'LEGACY_PRODUCT_DELETE_FAILED');
  }
};

// ============================================================================
// Stock Adjustments
// ============================================================================

export const adjustStock = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const pageId = req.params.pageId as string;
    const productId = req.params.productId as string;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const v = new Validator();
    const type = v.oneOf(body.type, 'type', MOVEMENT_TYPES);
    // 'in' / 'out' move a positive amount; 'adjustment' sets the exact (non-negative) level
    const quantity = type === 'adjustment'
      ? v.integer(body.quantity, 'quantity', { min: 0 })
      : v.integer(body.quantity, 'quantity', { positive: true });
    const reason = v.optionalString(body.reason, 'reason', { max: 500 });
    const notes = v.optionalString(body.notes, 'notes', { max: 2000 });
    v.throwIfAny();

    await ownedPage(req, pageId);

    const product = await prisma.product.findFirst({
      where: { id: productId, pageId },
    });

    if (!product) return fail(req, res, 'PRODUCT_NOT_FOUND');

    // Calculate new quantity
    let newQuantity = product.quantity;
    if (type === 'in') {
      newQuantity += quantity;
    } else if (type === 'out') {
      newQuantity -= quantity;
      if (newQuantity < 0) {
        return fail(req, res, 'LEGACY_INSUFFICIENT_STOCK', { product: product.name, available: product.quantity });
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
    return handleError(req, res, error, 'LEGACY_STOCK_ADJUST_FAILED');
  }
};

export const getStockMovements = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const pageId = req.params.pageId as string;
    const { productId, type } = req.query;
    const { limit, offset } = pagination(req.query);

    await ownedPage(req, pageId);

    const where: any = { pageId };
    if (productId) where.productId = productId as string;
    if (type) where.type = type as string;

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
    return handleError(req, res, error, 'LEGACY_MOVEMENTS_FAILED');
  }
};

// ============================================================================
// Suppliers
// ============================================================================

export const getSuppliers = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const pageId = req.params.pageId as string;

    await ownedPage(req, pageId);

    const suppliers = await prisma.supplier.findMany({
      where: { pageId, isActive: true },
      include: { _count: { select: { purchases: true } } },
      orderBy: { name: 'asc' },
    });

    res.json({ suppliers });
  } catch (error) {
    return handleError(req, res, error, 'LEGACY_SUPPLIER_LIST_FAILED');
  }
};

export const createSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const pageId = req.params.pageId as string;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const v = new Validator();
    const name = v.requiredString(body.name, 'name', { max: 200 });
    const email = v.email(body.email, 'email', false);
    const phone = v.phone(body.phone, 'phone', false);
    const address = v.optionalString(body.address, 'address', { max: 1000 });
    const notes = v.optionalString(body.notes, 'notes', { max: 2000 });
    v.throwIfAny();

    await ownedPage(req, pageId);

    const existing = await prisma.supplier.findFirst({ where: { pageId, name }, select: { id: true } });
    if (existing) return fail(req, res, 'LEGACY_SUPPLIER_EXISTS');

    const supplier = await prisma.supplier.create({
      data: { pageId, name, email, phone, address, notes },
    });

    res.status(201).json({ supplier });
  } catch (error) {
    return handleError(req, res, error, 'LEGACY_SUPPLIER_CREATE_FAILED');
  }
};

export const updateSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const pageId = req.params.pageId as string;
    const supplierId = req.params.supplierId as string;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const v = new Validator();
    const name = body.name === undefined || body.name === null || body.name === '' ? undefined : v.requiredString(body.name, 'name', { max: 200 });
    const email = body.email === undefined ? undefined : v.email(body.email, 'email', false);
    const phone = body.phone === undefined ? undefined : v.phone(body.phone, 'phone', false);
    const address = body.address === undefined ? undefined : v.optionalString(body.address, 'address', { max: 1000 });
    const notes = body.notes === undefined ? undefined : v.optionalString(body.notes, 'notes', { max: 2000 });
    const isActive = body.isActive === undefined || body.isActive === null ? undefined : v.boolean(body.isActive, 'isActive');
    v.throwIfAny();

    await ownedPage(req, pageId);

    // IDOR guard: the supplier must belong to this page
    const existing = await prisma.supplier.findFirst({ where: { id: supplierId, pageId }, select: { id: true } });
    if (!existing) return fail(req, res, 'SUPPLIER_NOT_FOUND');

    if (name) {
      const clash = await prisma.supplier.findFirst({ where: { pageId, name, id: { not: supplierId } }, select: { id: true } });
      if (clash) return fail(req, res, 'LEGACY_SUPPLIER_EXISTS');
    }

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
  } catch (error) {
    return handleError(req, res, error, 'LEGACY_SUPPLIER_UPDATE_FAILED');
  }
};

export const deleteSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const pageId = req.params.pageId as string;
    const supplierId = req.params.supplierId as string;

    await ownedPage(req, pageId);

    const existing = await prisma.supplier.findFirst({ where: { id: supplierId, pageId }, select: { id: true } });
    if (!existing) return fail(req, res, 'SUPPLIER_NOT_FOUND');

    await prisma.supplier.update({
      where: { id: supplierId },
      data: { isActive: false },
    });

    res.json({ success: true });
  } catch (error) {
    return handleError(req, res, error, 'LEGACY_SUPPLIER_DELETE_FAILED');
  }
};

// ============================================================================
// Dashboard / Stats
// ============================================================================

export const getStockDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const pageId = req.params.pageId as string;

    await ownedPage(req, pageId);

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
    return handleError(req, res, error, 'LEGACY_DASHBOARD_FAILED');
  }
};
