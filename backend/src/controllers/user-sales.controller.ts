import { Request, Response } from 'express';
import prisma from '../config/database';
import { ApiError, fail, handleError } from '../errors';
import { Validator, pagination } from '../middleware/validate';
import { recalcParentQuantity } from './user-product-variants.controller';

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// Enumerations mirrored from the Prisma schema comments (model Sale)
const PAYMENT_METHODS = ['cash', 'card', 'transfer', 'ccp', 'other'] as const;
const PAYMENT_STATUSES = ['pending', 'partial', 'paid'] as const;

// Payment status is DERIVED server-side from the cash actually received (P4):
// 0 -> pending, >= total -> paid, else partial.
const derivePaymentStatus = (amountPaid: number, total: number): string => {
  if (amountPaid <= 0) return total <= 0 ? 'paid' : 'pending';
  return amountPaid >= total ? 'paid' : 'partial';
};

// Generate sale number inside a transaction client to avoid race conditions
const generateSaleNumber = async (tx: TxClient, userId: string): Promise<string> => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

  const lastSale = await tx.sale.findFirst({
    where: {
      userId,
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

// ============================================================================
// Sales
// ============================================================================

export const getSales = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const { search, hasRemaining } = req.query;
    const v = new Validator();
    const startDate = v.date(req.query.startDate, 'startDate');
    const endDate = v.date(req.query.endDate, 'endDate');
    const paymentStatus = v.oneOf(req.query.paymentStatus, 'paymentStatus', PAYMENT_STATUSES, PAYMENT_STATUSES[0]);
    const paymentMethod = v.oneOf(req.query.paymentMethod, 'paymentMethod', PAYMENT_METHODS, PAYMENT_METHODS[0]);
    const minTotal = v.number(req.query.minTotal, 'minTotal', { required: false, min: 0 });
    const maxTotal = v.number(req.query.maxTotal, 'maxTotal', { required: false, min: 0 });
    v.throwIfAny();
    if (startDate && endDate && startDate > endDate) throw new ApiError('INVALID_DATE_RANGE');
    const { limit, offset } = pagination(req.query);

    const where: any = { userId: req.user.userId };

    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) where.saleDate.gte = startDate;
      if (endDate) where.saleDate.lte = endDate;
    }

    if (hasRemaining === 'true') {
      where.paymentStatus = { not: 'paid' };
    } else if (req.query.paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    if (req.query.paymentMethod) where.paymentMethod = paymentMethod;

    if (search) {
      where.OR = [
        { saleNumber: { contains: search as string } },
        { customerName: { contains: search as string } },
        { customerPhone: { contains: search as string } },
        { notes: { contains: search as string } },
      ];
    }

    if (req.query.minTotal || req.query.maxTotal) {
      where.total = {};
      if (req.query.minTotal) where.total.gte = minTotal;
      if (req.query.maxTotal) where.total.lte = maxTotal;
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
    return handleError(req, res, error, 'SALE_FETCH_FAILED');
  }
};

export const getSale = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const saleId = req.params.saleId as string;

    const sale = await prisma.sale.findFirst({
      where: { id: saleId, userId: req.user.userId },
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
    return handleError(req, res, error, 'SALE_FETCH_FAILED');
  }
};

export const createSale = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const v = new Validator();
    const customerName = v.optionalString(req.body.customerName, 'customerName', { max: 191 });
    const customerPhone = v.optionalString(req.body.customerPhone, 'customerPhone', { max: 50 });
    const notes = v.optionalString(req.body.notes, 'notes');
    const items = v.nonEmptyArray<any>(req.body.items, 'items', 'item');
    // Coerced to finite numbers: a string "tax" used to be concatenated into the total
    const discount = v.number(req.body.discount, 'discount', { required: false, def: 0, min: 0 });
    const tax = v.number(req.body.tax, 'tax', { required: false, def: 0, min: 0 });
    const paymentMethod = v.oneOf(req.body.paymentMethod, 'paymentMethod', PAYMENT_METHODS, 'cash');
    const paymentStatus = v.oneOf(req.body.paymentStatus, 'paymentStatus', PAYMENT_STATUSES, 'paid');
    const amountPaidGiven = req.body.amountPaid !== undefined && req.body.amountPaid !== null && req.body.amountPaid !== '';
    const amountPaid = amountPaidGiven ? v.number(req.body.amountPaid, 'amountPaid', { min: 0 }) : null;
    // Optional sale date (must not be more than 1 day in the future)
    const saleDateValue = v.date(req.body.saleDate, 'saleDate', { notFuture: true }) ?? undefined;

    // Per-line scalar checks (product existence / variants / stock come after)
    const lineInputs = items.map((item, i) => ({
      productId: v.id(item?.productId, `items[${i}].productId`),
      variantId: item?.variantId ? String(item.variantId) : null,
      quantity: v.integer(item?.quantity, `items[${i}].quantity`, { positive: true }),
      // `??` (not `||`): an explicit 0 unit price is a legal free item (P8);
      // absent → resolved from the product / variant below
      unitPrice: item?.unitPrice === undefined || item?.unitPrice === null || item?.unitPrice === ''
        ? null
        : v.number(item.unitPrice, `items[${i}].unitPrice`, { min: 0 }),
      discount: v.number(item?.discount, `items[${i}].discount`, { required: false, def: 0, min: 0 }),
    }));
    v.throwIfAny();

    // Verify all products exist (duplicate productIds are legal: two variants of
    // the same product can appear as separate lines)
    const uniqueProductIds = Array.from(new Set(lineInputs.map((l) => l.productId as string)));
    const products = await prisma.product.findMany({
      where: { id: { in: uniqueProductIds }, userId: req.user.userId, isActive: true },
      include: { variants: true },
    });

    if (products.length !== uniqueProductIds.length) throw new ApiError('PRODUCTS_NOT_FOUND');

    // Resolve variants and pre-check stock (friendly errors only — the
    // authoritative guard is the conditional decrement inside the transaction)
    let subtotal = 0;
    const resolvedItems: {
      productId: string;
      productName: string;
      variantId: string | null;
      quantity: number;
      unitPrice: number;
      discount: number;
      total: number;
    }[] = [];

    for (const line of lineInputs) {
      const product = products.find((p) => p.id === line.productId)!;
      const quantity = line.quantity;

      let variant = null;
      if (product.hasVariants) {
        if (!line.variantId) throw new ApiError('SALE_VARIANT_REQUIRED', { product: product.name });
        variant = product.variants.find((vr) => vr.id === line.variantId && vr.isActive) || null;
        if (!variant) throw new ApiError('SALE_VARIANT_NOT_FOUND', { product: product.name });
        if (variant.quantity < quantity) {
          throw new ApiError('SALE_INSUFFICIENT_STOCK', { product: `${product.name} (${variant.name})` });
        }
      } else if (product.quantity < quantity) {
        throw new ApiError('SALE_INSUFFICIENT_STOCK', { product: product.name });
      }

      const unitPrice = line.unitPrice ?? Number(variant ? variant.sellingPrice : product.sellingPrice);
      const itemDiscount = line.discount;
      const itemTotal = (unitPrice * quantity) - itemDiscount;
      subtotal += itemTotal;

      resolvedItems.push({
        productId: product.id,
        productName: variant ? `${product.name} - ${variant.name}` : product.name,
        variantId: variant ? variant.id : null,
        quantity,
        unitPrice,
        discount: itemDiscount,
        total: itemTotal,
      });
    }

    const total = subtotal - discount + tax;

    // Clamp amountPaid and derive payment status server-side (P4). Older clients
    // only send paymentStatus — map it onto amountPaid for backward compatibility.
    const paid = amountPaid !== null
      ? Math.min(Math.max(amountPaid, 0), Math.max(total, 0))
      : paymentStatus === 'paid' ? Math.max(total, 0) : 0;
    const derivedPaymentStatus = derivePaymentStatus(paid, total);

    // Create sale and update stock in transaction (number generation inside to prevent race condition)
    const MAX_RETRIES = 3;
    let sale;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        sale = await prisma.$transaction(async (tx) => {
      const saleNumber = await generateSaleNumber(tx, req.user!.userId);
      const newSale = await tx.sale.create({
        data: {
          userId: req.user!.userId,
          saleNumber,
          customerName,
          customerPhone,
          subtotal,
          discount,
          tax,
          total,
          amountPaid: paid,
          paymentMethod,
          paymentStatus: derivedPaymentStatus,
          notes,
          ...(saleDateValue && { saleDate: saleDateValue }),
          items: {
            create: resolvedItems.map(({ variantId, ...saleItem }) => saleItem),
          },
        },
        include: { items: true },
      });

      // Deduct stock atomically — conditional decrements close the check-then-act
      // race: if stock changed since the pre-check, count is 0 and we roll back.
      const variantProductIds = new Set<string>();
      for (const item of resolvedItems) {
        if (item.variantId) {
          const result = await tx.productVariant.updateMany({
            where: {
              id: item.variantId,
              productId: item.productId,
              quantity: { gte: item.quantity },
            },
            data: { quantity: { decrement: item.quantity } },
          });
          if (result.count !== 1) {
            throw new ApiError('SALE_INSUFFICIENT_STOCK', { product: item.productName });
          }
          variantProductIds.add(item.productId);
        } else {
          const result = await tx.product.updateMany({
            where: {
              id: item.productId,
              userId: req.user!.userId,
              quantity: { gte: item.quantity },
            },
            data: { quantity: { decrement: item.quantity } },
          });
          if (result.count !== 1) {
            throw new ApiError('SALE_INSUFFICIENT_STOCK', { product: item.productName });
          }
        }

        await tx.stockMovement.create({
          data: {
            userId: req.user!.userId,
            productId: item.productId,
            variantId: item.variantId,
            type: 'out',
            quantity: -item.quantity,
            reference: newSale.id,
            reason: `Sale ${saleNumber}`,
          },
        });
      }

      // Keep parent quantity = sum of active variants after variant deductions
      for (const productId of Array.from(variantProductIds)) {
        await recalcParentQuantity(tx, productId);
      }

      // Auto caisse entry for the cash actually received (P4: rows represent cash moved)
      if (paid > 0) {
        await tx.caisseTransaction.create({
          data: {
            userId: req.user!.userId,
            type: 'income',
            amount: paid,
            category: 'sale',
            reference: saleNumber,
            description: `Sale ${saleNumber}`,
            date: new Date(),
            isAutomatic: true,
            sourceId: newSale.id,
          },
        });
      }

      return newSale;
    });
        break; // Success, exit retry loop
      } catch (txError: any) {
        // P2002 = unique constraint violation (duplicate sale number)
        if (txError.code === 'P2002' && attempt < MAX_RETRIES - 1) {
          continue; // Retry with a new number
        }
        throw txError;
      }
    }

    res.status(201).json({ sale });
  } catch (error) {
    return handleError(req, res, error, 'SALE_CREATE_FAILED');
  }
};

export const updateSalePayment = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const saleId = req.params.saleId as string;

    const v = new Validator();
    const paymentStatus = req.body.paymentStatus ? v.oneOf(req.body.paymentStatus, 'paymentStatus', PAYMENT_STATUSES) : undefined;
    const paymentMethod = req.body.paymentMethod ? v.oneOf(req.body.paymentMethod, 'paymentMethod', PAYMENT_METHODS) : undefined;
    const amountPaidGiven = req.body.amountPaid !== undefined && req.body.amountPaid !== null;
    const amountPaid = amountPaidGiven ? v.number(req.body.amountPaid, 'amountPaid', { min: 0 }) : null;
    const notes = req.body.notes === undefined ? undefined : v.optionalString(req.body.notes, 'notes');
    v.throwIfAny();

    const existing = await prisma.sale.findFirst({
      where: { id: saleId, userId: req.user.userId },
    });

    if (!existing) return fail(req, res, 'SALE_NOT_FOUND');

    const total = Number(existing.total);
    const currentPaid = Number(existing.amountPaid);

    // Resolve the new amountPaid (P4: amountPaid is the source of truth; the
    // payment status is derived from it). Older clients only send a status —
    // map it onto amountPaid for backward compatibility.
    const touchingPayment = amountPaid !== null || !!paymentStatus;
    let newPaid = currentPaid;
    if (amountPaid !== null) {
      newPaid = Math.min(Math.max(amountPaid, 0), Math.max(total, 0));
    } else if (paymentStatus === 'paid') {
      newPaid = Math.max(total, 0);
    } else if (paymentStatus === 'pending') {
      newPaid = 0;
    }
    // 'partial' without an explicit amount keeps the current amountPaid

    const derivedPaymentStatus = derivePaymentStatus(newPaid, total);
    const paymentChanged = newPaid !== currentPaid;

    const sale = await prisma.$transaction(async (tx) => {
      const updated = await tx.sale.update({
        where: { id: saleId },
        data: {
          ...(touchingPayment && { amountPaid: newPaid, paymentStatus: derivedPaymentStatus }),
          ...(paymentMethod && { paymentMethod }),
          ...(notes !== undefined && { notes }),
        },
        include: { items: true },
      });

      // Recompute the automatic caisse rows whenever the cash received changes
      // (up OR down): delete the automatic rows for this sale, then post ONE
      // income row for the current amountPaid. Manual rows are never touched.
      if (paymentChanged) {
        await tx.caisseTransaction.deleteMany({
          where: {
            userId: req.user!.userId,
            sourceId: saleId,
            category: 'sale',
            isAutomatic: true,
          },
        });
        if (newPaid > 0) {
          await tx.caisseTransaction.create({
            data: {
              userId: req.user!.userId,
              type: 'income',
              amount: newPaid,
              category: 'sale',
              reference: updated.saleNumber,
              description: `Sale ${updated.saleNumber}`,
              date: new Date(),
              isAutomatic: true,
              sourceId: saleId,
            },
          });
        }
      }

      return updated;
    });

    res.json({ sale });
  } catch (error) {
    return handleError(req, res, error, 'SALE_UPDATE_FAILED');
  }
};

// ============================================================================
// Delete Sale
// ============================================================================

export const deleteSale = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const saleId = req.params.saleId as string;

    const sale = await prisma.sale.findFirst({
      where: { id: saleId, userId: req.user.userId },
      include: { items: true },
    });

    if (!sale) return fail(req, res, 'SALE_NOT_FOUND');

    // Only cash actually received blocks deletion. A zero-total sale is
    // derived 'paid' with amountPaid = 0 — it must stay deletable.
    if (Number(sale.amountPaid) > 0) {
      return fail(req, res, sale.paymentStatus === 'paid' ? 'SALE_DELETE_PAID' : 'SALE_DELETE_WITH_PAYMENTS');
    }

    // The sale's 'out' movements are the authoritative record of what was
    // deducted (including variant-level deductions — SaleItem has no variantId
    // column), so restore stock from them.
    const outMovements = await prisma.stockMovement.findMany({
      where: { userId: req.user.userId, reference: saleId, type: 'out' },
    });

    // Delete sale and restore stock in transaction
    await prisma.$transaction(async (tx) => {
      const variantProductIds = new Set<string>();

      if (outMovements.length > 0) {
        for (const movement of outMovements) {
          const restoreQty = Math.abs(movement.quantity);
          if (restoreQty === 0) continue;

          if (movement.variantId) {
            await tx.productVariant.updateMany({
              where: { id: movement.variantId, productId: movement.productId },
              data: { quantity: { increment: restoreQty } },
            });
            variantProductIds.add(movement.productId);
          } else {
            await tx.product.update({
              where: { id: movement.productId },
              data: { quantity: { increment: restoreQty } },
            });
          }

          // Create return stock movement (mirrors the original deduction)
          await tx.stockMovement.create({
            data: {
              userId: req.user!.userId,
              productId: movement.productId,
              variantId: movement.variantId,
              type: 'return',
              quantity: restoreQty,
              reference: sale.id,
              reason: `Deleted sale ${sale.saleNumber}`,
            },
          });
        }
      } else {
        // Legacy sales without movements: restore at the product level from items
        for (const item of sale.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { quantity: { increment: item.quantity } },
          });

          await tx.stockMovement.create({
            data: {
              userId: req.user!.userId,
              productId: item.productId,
              type: 'return',
              quantity: item.quantity,
              reference: sale.id,
              reason: `Deleted sale ${sale.saleNumber}`,
            },
          });
        }
      }

      // Keep parent quantity = sum of active variants after variant restores
      for (const productId of Array.from(variantProductIds)) {
        await recalcParentQuantity(tx, productId);
      }

      // Delete related automatic caisse transactions (manual rows survive)
      await tx.caisseTransaction.deleteMany({
        where: { userId: req.user!.userId, sourceId: saleId, isAutomatic: true },
      });

      // Delete sale (cascades to items)
      await tx.sale.delete({ where: { id: saleId } });
    });

    res.json({ success: true });
  } catch (error) {
    return handleError(req, res, error, 'SALE_DELETE_FAILED');
  }
};

// ============================================================================
// Sales Stats
// ============================================================================

export const getSalesStats = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const { period = 'today' } = req.query;

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
      userId: req.user.userId,
      saleDate: { gte: startDate },
    };

    // CA / chiffre d'affaires represents revenue ACTUALLY earned. Per v2 bug
    // report (CD.png / CD2.png) only `delivered` orders should be included —
    // pending / confirmed / shipped haven't reached the customer yet and could
    // still be cancelled, so counting them would inflate the merchant's
    // reported revenue. Walk-in `Sale` rows are always immediate-revenue, so
    // they stay in the count unconditionally.
    const orderWhere = {
      userId: req.user.userId,
      orderDate: { gte: startDate },
      status: 'delivered',
    };

    const [
      totalSales,
      totalRevenue,
      paidSales,
      pendingSales,
      saleTopProducts,
      orderTopProducts,
      totalOrders,
      orderRevenue,
      paidOrders,
      pendingOrders,
    ] = await Promise.all([
      prisma.sale.count({ where }),
      prisma.sale.aggregate({
        where,
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
      }),
      prisma.orderItem.groupBy({
        by: ['productId', 'productName'],
        where: {
          order: orderWhere,
        },
        _sum: { quantity: true, total: true },
      }),
      prisma.order.count({ where: orderWhere }),
      prisma.order.aggregate({
        where: orderWhere,
        _sum: { total: true },
      }),
      prisma.order.count({ where: { ...orderWhere, paymentStatus: 'paid' } }),
      prisma.order.count({ where: { ...orderWhere, paymentStatus: 'pending' } }),
    ]);

    // topProducts must cover the same revenue base as totalRevenue (P6): merge
    // walk-in sale items with delivered-order items, grouped by productId.
    const productTotals = new Map<
      string,
      { productId: string; productName: string; _sum: { quantity: number; total: number } }
    >();
    for (const group of [...saleTopProducts, ...orderTopProducts]) {
      const quantity = group._sum.quantity || 0;
      const groupTotal = Number(group._sum.total) || 0;
      const entry = productTotals.get(group.productId);
      if (entry) {
        entry._sum.quantity += quantity;
        entry._sum.total += groupTotal;
      } else {
        productTotals.set(group.productId, {
          productId: group.productId,
          productName: group.productName,
          _sum: { quantity, total: groupTotal },
        });
      }
    }
    const topProducts = Array.from(productTotals.values())
      .sort((a, b) => b._sum.total - a._sum.total)
      .slice(0, 5);

    // "Chiffre d'affaires" should reflect ALL revenue: walk-in sales + online
    // and manual orders combined. The bug report explicitly called out that
    // online/manual orders were being excluded.
    const saleRevenueNum = Number(totalRevenue._sum.total) || 0;
    const orderRevenueNum = Number(orderRevenue._sum.total) || 0;
    const combinedRevenue = saleRevenueNum + orderRevenueNum;
    const combinedCount = totalSales + totalOrders;
    const averageOrderValue = combinedCount > 0 ? combinedRevenue / combinedCount : 0;

    res.json({
      stats: {
        totalSales: combinedCount,
        totalRevenue: combinedRevenue,
        paidSales: paidSales + paidOrders,
        pendingSales: pendingSales + pendingOrders,
        averageOrderValue,
      },
      topProducts,
    });
  } catch (error) {
    return handleError(req, res, error, 'SALE_STATS_FAILED');
  }
};
