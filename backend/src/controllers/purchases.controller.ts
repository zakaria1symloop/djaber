import { Request, Response } from 'express';
import prisma from '../config/database';
import { ApiError, fail, handleError } from '../errors';
import { Validator, pagination } from '../middleware/validate';
import { ownedPage } from './stock.controller';

const PURCHASE_STATUSES = ['pending', 'partial', 'received', 'cancelled'] as const;
const PAYMENT_STATUSES = ['pending', 'paid', 'partial'] as const;
const PERIODS = ['week', 'month', 'year'] as const;

interface PurchaseItemInput {
  productId: string;
  quantity: number;
  unitCost: number | null;
}

// Generate purchase number
const generatePurchaseNumber = async (pageId: string): Promise<string> => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

  const lastPurchase = await prisma.purchase.findFirst({
    where: {
      pageId,
      purchaseNumber: { startsWith: `PO-${dateStr}` },
    },
    orderBy: { purchaseNumber: 'desc' },
  });

  let sequence = 1;
  if (lastPurchase) {
    const lastSeq = parseInt(lastPurchase.purchaseNumber.split('-')[2], 10);
    sequence = lastSeq + 1;
  }

  return `PO-${dateStr}-${sequence.toString().padStart(4, '0')}`;
};

/** Validate the `items` array of a purchase: non-empty, numeric quantities, no duplicate products. */
const validatePurchaseItems = (v: Validator, raw: unknown): PurchaseItemInput[] => {
  const list = v.nonEmptyArray<Record<string, unknown>>(raw, 'items', 'product');
  const items = list.map((item, i) => {
    const it = (item ?? {}) as Record<string, unknown>;
    return {
      productId: v.requiredString(it.productId, `items[${i}].productId`, { max: 64 }),
      quantity: v.integer(it.quantity, `items[${i}].quantity`, { positive: true }),
      unitCost: it.unitCost === undefined || it.unitCost === null || it.unitCost === '' ? null : v.number(it.unitCost, `items[${i}].unitCost`, { min: 0 }),
    };
  });
  const ids = items.map((i) => i.productId).filter(Boolean);
  if (new Set(ids).size !== ids.length) v.add('items', 'LEGACY_DUPLICATE_PRODUCTS');
  return items;
};

// ============================================================================
// Purchases
// ============================================================================

export const getPurchases = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const pageId = req.params.pageId as string;
    const { limit, offset } = pagination(req.query);

    const v = new Validator();
    const startDate = v.date(req.query.startDate, 'startDate');
    const endDate = v.date(req.query.endDate, 'endDate');
    const status = req.query.status ? v.oneOf(req.query.status, 'status', PURCHASE_STATUSES) : null;
    const supplierId = v.optionalString(req.query.supplierId, 'supplierId', { max: 64 });
    if (startDate && endDate && startDate.getTime() > endDate.getTime()) v.add('endDate', 'INVALID_DATE_RANGE');
    v.throwIfAny();

    await ownedPage(req, pageId);

    const where: any = { pageId };

    if (startDate || endDate) {
      where.purchaseDate = {};
      if (startDate) where.purchaseDate.gte = startDate;
      if (endDate) where.purchaseDate.lte = endDate;
    }

    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
        },
        orderBy: { purchaseDate: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.purchase.count({ where }),
    ]);

    res.json({ purchases, total });
  } catch (error) {
    return handleError(req, res, error, 'LEGACY_PURCHASE_LIST_FAILED');
  }
};

export const getPurchase = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const pageId = req.params.pageId as string;
    const purchaseId = req.params.purchaseId as string;

    await ownedPage(req, pageId);

    const purchase = await prisma.purchase.findFirst({
      where: { id: purchaseId, pageId },
      include: {
        supplier: true,
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, imageUrl: true } },
          },
        },
      },
    });

    if (!purchase) return fail(req, res, 'PURCHASE_NOT_FOUND');

    res.json({ purchase });
  } catch (error) {
    return handleError(req, res, error, 'LEGACY_PURCHASE_FETCH_FAILED');
  }
};

export const createPurchase = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const pageId = req.params.pageId as string;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const v = new Validator();
    const supplierId = v.optionalString(body.supplierId, 'supplierId', { max: 64 });
    const items = validatePurchaseItems(v, body.items);
    const tax = v.number(body.tax, 'tax', { required: false, def: 0, min: 0 });
    const shippingCost = v.number(body.shippingCost, 'shippingCost', { required: false, def: 0, min: 0 });
    const paymentStatus = v.oneOf(body.paymentStatus, 'paymentStatus', PAYMENT_STATUSES, 'pending');
    const status = v.oneOf(body.status, 'status', PURCHASE_STATUSES, 'pending');
    const expectedDate = v.date(body.expectedDate, 'expectedDate');
    const notes = v.optionalString(body.notes, 'notes', { max: 2000 });
    v.throwIfAny();

    await ownedPage(req, pageId);

    // Supplier (when given) must belong to this page
    if (supplierId) {
      const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, pageId }, select: { id: true } });
      if (!supplier) return fail(req, res, 'SUPPLIER_NOT_FOUND');
    }

    // Verify all products exist on this page
    const productIds = items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, pageId },
    });

    if (products.length !== productIds.length) return fail(req, res, 'PRODUCTS_NOT_FOUND');

    // Calculate totals
    let subtotal = 0;
    const purchaseItems = items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      const unitCost = item.unitCost ?? Number(product.costPrice);
      const itemTotal = unitCost * item.quantity;
      subtotal += itemTotal;

      return {
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitCost,
        total: itemTotal,
      };
    });

    const total = subtotal + tax + shippingCost;

    // Generate purchase number
    const purchaseNumber = await generatePurchaseNumber(pageId);

    // Create purchase
    const purchase = await prisma.purchase.create({
      data: {
        pageId,
        purchaseNumber,
        supplierId,
        subtotal,
        tax,
        shippingCost,
        total,
        paymentStatus,
        status,
        expectedDate,
        notes,
        items: {
          create: purchaseItems,
        },
      },
      include: {
        supplier: true,
        items: true,
      },
    });

    res.status(201).json({ purchase });
  } catch (error) {
    return handleError(req, res, error, 'LEGACY_PURCHASE_CREATE_FAILED');
  }
};

export const updatePurchase = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const pageId = req.params.pageId as string;
    const purchaseId = req.params.purchaseId as string;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const v = new Validator();
    const paymentStatus = body.paymentStatus ? v.oneOf(body.paymentStatus, 'paymentStatus', PAYMENT_STATUSES) : undefined;
    const status = body.status ? v.oneOf(body.status, 'status', PURCHASE_STATUSES) : undefined;
    const expectedDate = body.expectedDate === undefined ? undefined : v.date(body.expectedDate, 'expectedDate');
    const notes = body.notes === undefined ? undefined : v.optionalString(body.notes, 'notes', { max: 2000 });
    v.throwIfAny();

    await ownedPage(req, pageId);

    // IDOR guard: the purchase must belong to this page
    const existing = await prisma.purchase.findFirst({ where: { id: purchaseId, pageId }, select: { id: true } });
    if (!existing) return fail(req, res, 'PURCHASE_NOT_FOUND');

    const purchase = await prisma.purchase.update({
      where: { id: purchaseId },
      data: {
        ...(paymentStatus && { paymentStatus }),
        ...(status && { status }),
        ...(expectedDate !== undefined && { expectedDate }),
        ...(notes !== undefined && { notes }),
      },
      include: { supplier: true, items: true },
    });

    res.json({ purchase });
  } catch (error) {
    return handleError(req, res, error, 'LEGACY_PURCHASE_UPDATE_FAILED');
  }
};

// ============================================================================
// Receive Purchase Items
// ============================================================================

export const receivePurchaseItems = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const pageId = req.params.pageId as string;
    const purchaseId = req.params.purchaseId as string;
    const body = (req.body ?? {}) as Record<string, unknown>;

    // Array of { itemId, receivedQty }
    const v = new Validator();
    const list = v.nonEmptyArray<Record<string, unknown>>(body.items, 'items', 'item');
    const items = list.map((item, i) => {
      const it = (item ?? {}) as Record<string, unknown>;
      return {
        itemId: v.requiredString(it.itemId, `items[${i}].itemId`, { max: 64 }),
        receivedQty: v.integer(it.receivedQty, `items[${i}].receivedQty`, { min: 0 }),
      };
    });
    const itemIds = items.map((i) => i.itemId).filter(Boolean);
    if (new Set(itemIds).size !== itemIds.length) v.add('items', 'FIELD_INVALID');
    v.throwIfAny();

    await ownedPage(req, pageId);

    const purchase = await prisma.purchase.findFirst({
      where: { id: purchaseId, pageId },
      include: { items: true },
    });

    if (!purchase) return fail(req, res, 'PURCHASE_NOT_FOUND');

    // Every line must belong to this purchase
    for (const item of items) {
      if (!purchase.items.some((pi) => pi.id === item.itemId)) {
        return fail(req, res, 'LEGACY_PURCHASE_ITEM_NOT_FOUND', { itemId: item.itemId });
      }
    }

    // Process receiving in transaction
    const updatedPurchase = await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const purchaseItem = purchase.items.find((pi) => pi.id === item.itemId);
        if (!purchaseItem) throw new ApiError('LEGACY_PURCHASE_ITEM_NOT_FOUND', { itemId: item.itemId });

        const additionalQty = item.receivedQty - purchaseItem.receivedQty;
        if (additionalQty <= 0) continue;

        // Update purchase item received quantity
        await tx.purchaseItem.update({
          where: { id: item.itemId },
          data: { receivedQty: item.receivedQty },
        });

        // Update product stock
        await tx.product.update({
          where: { id: purchaseItem.productId },
          data: { quantity: { increment: additionalQty } },
        });

        // Create stock movement
        await tx.stockMovement.create({
          data: {
            pageId,
            productId: purchaseItem.productId,
            type: 'in',
            quantity: additionalQty,
            reference: purchaseId,
            reason: `Purchase ${purchase.purchaseNumber}`,
          },
        });
      }

      // Check if all items are fully received
      const updatedItems = await tx.purchaseItem.findMany({
        where: { purchaseId },
      });

      const allReceived = updatedItems.every((i) => i.receivedQty >= i.quantity);
      const partialReceived = updatedItems.some((i) => i.receivedQty > 0);

      let newStatus = purchase.status;
      if (allReceived) {
        newStatus = 'received';
      } else if (partialReceived) {
        newStatus = 'partial';
      }

      // Update purchase status
      return tx.purchase.update({
        where: { id: purchaseId },
        data: {
          status: newStatus,
          ...(allReceived && { receivedDate: new Date() }),
        },
        include: { supplier: true, items: true },
      });
    });

    res.json({ purchase: updatedPurchase });
  } catch (error) {
    return handleError(req, res, error, 'LEGACY_PURCHASE_RECEIVE_FAILED');
  }
};

// ============================================================================
// Purchase Stats
// ============================================================================

export const getPurchaseStats = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const pageId = req.params.pageId as string;

    const v = new Validator();
    const period = v.oneOf(req.query.period, 'period', PERIODS, 'month');
    v.throwIfAny();

    await ownedPage(req, pageId);

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (period) {
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

    const where = {
      pageId,
      purchaseDate: { gte: startDate },
    };

    const [
      totalPurchases,
      totalSpent,
      pendingPurchases,
      receivedPurchases,
      topSuppliers,
    ] = await Promise.all([
      prisma.purchase.count({ where }),
      prisma.purchase.aggregate({
        where,
        _sum: { total: true },
      }),
      prisma.purchase.count({ where: { ...where, status: 'pending' } }),
      prisma.purchase.count({ where: { ...where, status: 'received' } }),
      prisma.purchase.groupBy({
        by: ['supplierId'],
        where: {
          ...where,
          supplierId: { not: null },
        },
        _sum: { total: true },
        _count: true,
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      }),
    ]);

    // Get supplier names
    const supplierIds = topSuppliers.map((s) => s.supplierId).filter(Boolean) as string[];
    const suppliers = await prisma.supplier.findMany({
      where: { id: { in: supplierIds } },
      select: { id: true, name: true },
    });

    const topSuppliersWithNames = topSuppliers.map((s) => ({
      ...s,
      supplierName: suppliers.find((sup) => sup.id === s.supplierId)?.name || 'Unknown',
    }));

    res.json({
      stats: {
        totalPurchases,
        totalSpent: totalSpent._sum.total || 0,
        pendingPurchases,
        receivedPurchases,
      },
      topSuppliers: topSuppliersWithNames,
    });
  } catch (error) {
    return handleError(req, res, error, 'LEGACY_PURCHASE_STATS_FAILED');
  }
};
