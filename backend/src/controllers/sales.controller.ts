import { Request, Response } from 'express';
import prisma from '../config/database';
import { ApiError, fail, handleError } from '../errors';
import { Validator, pagination } from '../middleware/validate';
import { ownedPage } from './stock.controller';

const PAYMENT_METHODS = ['cash', 'card', 'transfer', 'other'] as const;
const PAYMENT_STATUSES = ['paid', 'pending', 'partial'] as const;
const PERIODS = ['today', 'week', 'month', 'year'] as const;

interface SaleItemInput {
  productId: string;
  quantity: number;
  unitPrice: number | null;
  discount: number;
}

// Generate sale number
const generateSaleNumber = async (pageId: string): Promise<string> => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

  const lastSale = await prisma.sale.findFirst({
    where: {
      pageId,
      saleNumber: { startsWith: `SL-${dateStr}` },
    },
    orderBy: { saleNumber: 'desc' },
  });

  let sequence = 1;
  if (lastSale) {
    const lastSeq = parseInt(lastSale.saleNumber.split('-')[2], 10);
    sequence = lastSeq + 1;
  }

  return `SL-${dateStr}-${sequence.toString().padStart(4, '0')}`;
};

/** Validate the `items` array of a sale: non-empty, numeric quantities, no duplicate products. */
const validateSaleItems = (v: Validator, raw: unknown): SaleItemInput[] => {
  const list = v.nonEmptyArray<Record<string, unknown>>(raw, 'items', 'product');
  const items = list.map((item, i) => {
    const it = (item ?? {}) as Record<string, unknown>;
    return {
      productId: v.requiredString(it.productId, `items[${i}].productId`, { max: 64 }),
      quantity: v.integer(it.quantity, `items[${i}].quantity`, { positive: true }),
      unitPrice: it.unitPrice === undefined || it.unitPrice === null || it.unitPrice === '' ? null : v.number(it.unitPrice, `items[${i}].unitPrice`, { min: 0 }),
      discount: v.number(it.discount, `items[${i}].discount`, { required: false, def: 0, min: 0 }),
    };
  });
  const ids = items.map((i) => i.productId).filter(Boolean);
  if (new Set(ids).size !== ids.length) v.add('items', 'LEGACY_DUPLICATE_PRODUCTS');
  return items;
};

// ============================================================================
// Sales
// ============================================================================

export const getSales = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const pageId = req.params.pageId as string;
    const { limit, offset } = pagination(req.query);

    const v = new Validator();
    const startDate = v.date(req.query.startDate, 'startDate');
    const endDate = v.date(req.query.endDate, 'endDate');
    const paymentStatus = req.query.paymentStatus ? v.oneOf(req.query.paymentStatus, 'paymentStatus', PAYMENT_STATUSES) : null;
    if (startDate && endDate && startDate.getTime() > endDate.getTime()) v.add('endDate', 'INVALID_DATE_RANGE');
    v.throwIfAny();

    await ownedPage(req, pageId);

    const where: any = { pageId };

    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) where.saleDate.gte = startDate;
      if (endDate) where.saleDate.lte = endDate;
    }

    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
        },
        orderBy: { saleDate: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.sale.count({ where }),
    ]);

    res.json({ sales, total });
  } catch (error) {
    return handleError(req, res, error, 'LEGACY_SALE_LIST_FAILED');
  }
};

export const getSale = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const pageId = req.params.pageId as string;
    const saleId = req.params.saleId as string;

    await ownedPage(req, pageId);

    const sale = await prisma.sale.findFirst({
      where: { id: saleId, pageId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, imageUrl: true } },
          },
        },
      },
    });

    if (!sale) return fail(req, res, 'SALE_NOT_FOUND');

    res.json({ sale });
  } catch (error) {
    return handleError(req, res, error, 'LEGACY_SALE_FETCH_FAILED');
  }
};

export const createSale = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const pageId = req.params.pageId as string;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const v = new Validator();
    const customerName = v.optionalString(body.customerName, 'customerName', { max: 200 });
    const customerPhone = v.phone(body.customerPhone, 'customerPhone', false);
    const items = validateSaleItems(v, body.items);
    const discount = v.number(body.discount, 'discount', { required: false, def: 0, min: 0 });
    const tax = v.number(body.tax, 'tax', { required: false, def: 0, min: 0 });
    const paymentMethod = v.oneOf(body.paymentMethod, 'paymentMethod', PAYMENT_METHODS, 'cash');
    const paymentStatus = v.oneOf(body.paymentStatus, 'paymentStatus', PAYMENT_STATUSES, 'paid');
    const notes = v.optionalString(body.notes, 'notes', { max: 2000 });
    v.throwIfAny();

    await ownedPage(req, pageId);

    // Verify all products exist on this page and have enough stock
    const productIds = items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, pageId, isActive: true },
    });

    if (products.length !== productIds.length) return fail(req, res, 'PRODUCTS_NOT_FOUND');

    // Check stock availability
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) continue;
      if (product.quantity < item.quantity) {
        return fail(req, res, 'LEGACY_INSUFFICIENT_STOCK', { product: product.name, available: product.quantity });
      }
    }

    // Calculate totals
    let subtotal = 0;
    const saleItems = items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      const unitPrice = item.unitPrice ?? Number(product.sellingPrice);
      const itemDiscount = item.discount;
      const itemTotal = unitPrice * item.quantity - itemDiscount;
      subtotal += itemTotal;

      return {
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice,
        discount: itemDiscount,
        total: itemTotal,
      };
    });

    const total = subtotal - discount + tax;

    // Generate sale number
    const saleNumber = await generateSaleNumber(pageId);

    // Create sale and update stock in transaction
    const sale = await prisma.$transaction(async (tx) => {
      // Create sale
      const newSale = await tx.sale.create({
        data: {
          pageId,
          saleNumber,
          customerName,
          customerPhone,
          subtotal,
          discount,
          tax,
          total,
          paymentMethod,
          paymentStatus,
          notes,
          items: {
            create: saleItems,
          },
        },
        include: { items: true },
      });

      // Update product quantities and create stock movements
      for (const item of items) {
        // Re-check inside the transaction so concurrent sales cannot drive stock negative
        const current = await tx.product.findFirst({ where: { id: item.productId, pageId }, select: { name: true, quantity: true } });
        if (!current) throw new ApiError('PRODUCTS_NOT_FOUND');
        if (current.quantity < item.quantity) {
          throw new ApiError('LEGACY_INSUFFICIENT_STOCK', { product: current.name, available: current.quantity });
        }

        await tx.product.update({
          where: { id: item.productId },
          data: { quantity: { decrement: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            pageId,
            productId: item.productId,
            type: 'out',
            quantity: -item.quantity,
            reference: newSale.id,
            reason: `Sale ${saleNumber}`,
          },
        });
      }

      return newSale;
    });

    res.status(201).json({ sale });
  } catch (error) {
    return handleError(req, res, error, 'LEGACY_SALE_CREATE_FAILED');
  }
};

export const updateSalePayment = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const pageId = req.params.pageId as string;
    const saleId = req.params.saleId as string;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const v = new Validator();
    const paymentStatus = body.paymentStatus ? v.oneOf(body.paymentStatus, 'paymentStatus', PAYMENT_STATUSES) : undefined;
    const paymentMethod = body.paymentMethod ? v.oneOf(body.paymentMethod, 'paymentMethod', PAYMENT_METHODS) : undefined;
    const notes = body.notes === undefined ? undefined : v.optionalString(body.notes, 'notes', { max: 2000 });
    v.throwIfAny();

    await ownedPage(req, pageId);

    // IDOR guard: the sale must belong to this page
    const existing = await prisma.sale.findFirst({ where: { id: saleId, pageId }, select: { id: true } });
    if (!existing) return fail(req, res, 'SALE_NOT_FOUND');

    const sale = await prisma.sale.update({
      where: { id: saleId },
      data: {
        ...(paymentStatus && { paymentStatus }),
        ...(paymentMethod && { paymentMethod }),
        ...(notes !== undefined && { notes }),
      },
      include: { items: true },
    });

    res.json({ sale });
  } catch (error) {
    return handleError(req, res, error, 'LEGACY_SALE_UPDATE_FAILED');
  }
};

// ============================================================================
// Sales Stats
// ============================================================================

export const getSalesStats = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const pageId = req.params.pageId as string;

    const v = new Validator();
    const period = v.oneOf(req.query.period, 'period', PERIODS, 'today');
    v.throwIfAny();

    await ownedPage(req, pageId);

    // Calculate date range
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
        startDate = new Date(now.setHours(0, 0, 0, 0));
    }

    const where = {
      pageId,
      saleDate: { gte: startDate },
    };

    const [
      totalSales,
      totalRevenue,
      paidSales,
      pendingSales,
      topProducts,
    ] = await Promise.all([
      prisma.sale.count({ where }),
      prisma.sale.aggregate({
        where: { ...where, paymentStatus: 'paid' },
        _sum: { total: true },
      }),
      prisma.sale.count({ where: { ...where, paymentStatus: 'paid' } }),
      prisma.sale.count({ where: { ...where, paymentStatus: 'pending' } }),
      prisma.saleItem.groupBy({
        by: ['productId', 'productName'],
        where: {
          sale: where,
        },
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
    ]);

    res.json({
      stats: {
        totalSales,
        totalRevenue: totalRevenue._sum.total || 0,
        paidSales,
        pendingSales,
        averageOrderValue: totalSales > 0
          ? Number(totalRevenue._sum.total || 0) / totalSales
          : 0,
      },
      topProducts,
    });
  } catch (error) {
    return handleError(req, res, error, 'LEGACY_SALE_STATS_FAILED');
  }
};
