import { Request, Response } from 'express';
import prisma from '../config/database';
import { ApiError, fail, handleError } from '../errors';
import { Validator, pagination } from '../middleware/validate';
import { recalcParentQuantity } from './user-product-variants.controller';

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// Payment status is DERIVED server-side from the cash actually paid out (P4):
// 0 -> pending, >= total -> paid, else partial.
const derivePaymentStatus = (amountPaid: number, total: number): string => {
  if (amountPaid <= 0) return total <= 0 ? 'paid' : 'pending';
  return amountPaid >= total ? 'paid' : 'partial';
};

// Enumerations mirrored from the Prisma schema comments (model Purchase)
const PAYMENT_STATUSES = ['pending', 'partial', 'paid'] as const;
const PAYMENT_METHODS = ['cash', 'card', 'transfer', 'ccp', 'other'] as const;
const PURCHASE_STATUSES = ['pending', 'partial', 'received', 'cancelled'] as const;

// Status transition matrix (P5): received and cancelled are terminal.
// 'partial' / 'received' are reached ONLY through receivePurchaseItems —
// PUT may only cancel.
const PURCHASE_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['cancelled'],
  partial: ['cancelled'],
  received: [],
  cancelled: [],
};
const RECEIVE_ONLY_STATUSES = ['partial', 'received'];

// Generate purchase number inside a transaction client to avoid race conditions
const generatePurchaseNumber = async (tx: TxClient, userId: string): Promise<string> => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

  const lastPurchase = await tx.purchase.findFirst({
    where: {
      userId,
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

// ============================================================================
// Purchases
// ============================================================================

export const getPurchases = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const { supplierId, search, hasRemaining } = req.query;
    const v = new Validator();
    const startDate = v.date(req.query.startDate, 'startDate');
    const endDate = v.date(req.query.endDate, 'endDate');
    const status = v.oneOf(req.query.status, 'status', PURCHASE_STATUSES, PURCHASE_STATUSES[0]);
    const paymentStatus = v.oneOf(req.query.paymentStatus, 'paymentStatus', PAYMENT_STATUSES, PAYMENT_STATUSES[0]);
    const minTotal = v.number(req.query.minTotal, 'minTotal', { required: false, min: 0 });
    const maxTotal = v.number(req.query.maxTotal, 'maxTotal', { required: false, min: 0 });
    v.throwIfAny();
    if (startDate && endDate && startDate > endDate) throw new ApiError('INVALID_DATE_RANGE');
    const { limit, offset } = pagination(req.query);

    const where: any = { userId: req.user.userId };

    if (startDate || endDate) {
      where.purchaseDate = {};
      if (startDate) where.purchaseDate.gte = startDate;
      if (endDate) where.purchaseDate.lte = endDate;
    }

    if (req.query.status) where.status = status;
    if (hasRemaining === 'true') {
      where.paymentStatus = { not: 'paid' };
      // Cancelled purchases are not money owed
      if (!req.query.status) where.status = { not: 'cancelled' };
    } else if (req.query.paymentStatus) {
      where.paymentStatus = paymentStatus;
    }
    if (supplierId) where.supplierId = supplierId as string;

    if (search) {
      where.OR = [
        { purchaseNumber: { contains: search as string } },
        { notes: { contains: search as string } },
        { supplier: { name: { contains: search as string } } },
      ];
    }

    if (req.query.minTotal || req.query.maxTotal) {
      where.total = {};
      if (req.query.minTotal) where.total.gte = minTotal;
      if (req.query.maxTotal) where.total.lte = maxTotal;
    }

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
    return handleError(req, res, error, 'PURCHASE_FETCH_FAILED');
  }
};

export const getPurchase = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const purchaseId = req.params.purchaseId as string;

    const purchase = await prisma.purchase.findFirst({
      where: { id: purchaseId, userId: req.user.userId },
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
    return handleError(req, res, error, 'PURCHASE_FETCH_FAILED');
  }
};

export const createPurchase = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    // NOTE: `status` is intentionally NOT accepted from the client — new purchases
    // always start 'pending'; 'partial'/'received' are owned by receivePurchaseItems
    // and 'cancelled' by updatePurchase (P5).
    const v = new Validator();
    const supplierId = v.id(req.body.supplierId, 'supplierId', false);
    const items = v.nonEmptyArray<any>(req.body.items, 'items', 'item');
    const tax = v.number(req.body.tax, 'tax', { required: false, def: 0, min: 0 });
    const shippingCost = v.number(req.body.shippingCost, 'shippingCost', { required: false, def: 0, min: 0 });
    const paymentStatus = v.oneOf(req.body.paymentStatus, 'paymentStatus', PAYMENT_STATUSES, 'pending');
    const paymentMethod = v.oneOf(req.body.paymentMethod, 'paymentMethod', PAYMENT_METHODS, 'cash');
    const amountPaidGiven = req.body.amountPaid !== undefined && req.body.amountPaid !== null && req.body.amountPaid !== '';
    const amountPaid = amountPaidGiven ? v.number(req.body.amountPaid, 'amountPaid', { min: 0 }) : null;
    // Optional purchase date (must not be more than 1 day in the future)
    const purchaseDateValue = v.date(req.body.purchaseDate, 'purchaseDate', { notFuture: true }) ?? undefined;
    const expectedDate = v.date(req.body.expectedDate, 'expectedDate');
    const notes = v.optionalString(req.body.notes, 'notes');

    // Per-line scalar checks (product existence / variants come after)
    const lineInputs = items.map((item, i) => ({
      productId: v.id(item?.productId, `items[${i}].productId`),
      variantId: item?.variantId ? String(item.variantId) : null,
      quantity: v.integer(item?.quantity, `items[${i}].quantity`, { positive: true }),
      // `??` (not `||`): an explicit 0 unit cost is legal (e.g. free samples);
      // absent → resolved from the product / variant below
      unitCost: item?.unitCost === undefined || item?.unitCost === null || item?.unitCost === ''
        ? null
        : v.number(item.unitCost, `items[${i}].unitCost`, { min: 0 }),
    }));
    v.throwIfAny();

    // A linked supplier must exist AND belong to the caller
    if (supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: supplierId, userId: req.user.userId },
        select: { id: true },
      });
      if (!supplier) throw new ApiError('SUPPLIER_NOT_FOUND');
    }

    // Verify all products exist (items may repeat a product across variants)
    const uniqueProductIds = Array.from(new Set(lineInputs.map((l) => l.productId as string)));
    const products = await prisma.product.findMany({
      where: { id: { in: uniqueProductIds }, userId: req.user.userId },
      include: { variants: true },
    });

    if (products.length !== uniqueProductIds.length) throw new ApiError('PRODUCTS_NOT_FOUND');

    // Resolve lines: validate variants and compute totals. Variant products
    // must say WHICH variant is being restocked — otherwise receiving would
    // bump the parent quantity, which the invariant parent.quantity =
    // SUM(active variants) silently erases on the next variant transaction.
    let subtotal = 0;
    const purchaseItems: {
      productId: string;
      productName: string;
      variantId: string | null;
      variantName: string | null;
      quantity: number;
      unitCost: number;
      total: number;
    }[] = [];

    for (const line of lineInputs) {
      const product = products.find((p) => p.id === line.productId)!;

      let variant: (typeof product.variants)[number] | null = null;
      if (product.hasVariants) {
        if (!line.variantId) throw new ApiError('PURCHASE_VARIANT_REQUIRED', { product: product.name });
        variant = product.variants.find((vr) => vr.id === line.variantId) || null;
        if (!variant || !variant.isActive) throw new ApiError('PURCHASE_VARIANT_NOT_FOUND', { product: product.name });
      }

      const unitCost = line.unitCost ?? Number(variant ? variant.costPrice : product.costPrice);
      const itemTotal = unitCost * line.quantity;
      subtotal += itemTotal;

      purchaseItems.push({
        productId: product.id,
        productName: product.name,
        variantId: variant ? variant.id : null,
        variantName: variant ? variant.name : null,
        quantity: line.quantity,
        unitCost,
        total: itemTotal,
      });
    }

    const total = subtotal + tax + shippingCost;

    // Clamp amountPaid and derive payment status server-side (P4). Older clients
    // only send paymentStatus — map it onto amountPaid for backward compatibility.
    const paid = amountPaid !== null
      ? Math.min(Math.max(amountPaid, 0), Math.max(total, 0))
      : paymentStatus === 'paid' ? Math.max(total, 0) : 0;
    const derivedPaymentStatus = derivePaymentStatus(paid, total);

    // Create purchase with number generation inside transaction to prevent race condition
    const MAX_RETRIES = 3;
    let purchase;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        purchase = await prisma.$transaction(async (tx) => {
          const purchaseNumber = await generatePurchaseNumber(tx, req.user!.userId);

          const newPurchase = await tx.purchase.create({
            data: {
              userId: req.user!.userId,
              purchaseNumber,
              supplierId: supplierId || null,
              subtotal,
              tax,
              shippingCost,
              total,
              amountPaid: paid,
              paymentMethod,
              paymentStatus: derivedPaymentStatus,
              status: 'pending',
              ...(purchaseDateValue && { purchaseDate: purchaseDateValue }),
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

          // Auto caisse entry for the cash actually paid out (P4)
          if (paid > 0) {
            await tx.caisseTransaction.create({
              data: {
                userId: req.user!.userId,
                type: 'expense',
                amount: paid,
                category: 'purchase',
                reference: purchaseNumber,
                description: `Purchase ${purchaseNumber}`,
                date: new Date(),
                isAutomatic: true,
                sourceId: newPurchase.id,
              },
            });
          }

          return newPurchase;
        });
        break; // Success, exit retry loop
      } catch (txError: any) {
        if (txError.code === 'P2002' && attempt < MAX_RETRIES - 1) {
          continue; // Retry with a new number
        }
        throw txError;
      }
    }

    res.status(201).json({ purchase });
  } catch (error) {
    return handleError(req, res, error, 'PURCHASE_CREATE_FAILED');
  }
};

export const updatePurchase = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const purchaseId = req.params.purchaseId as string;

    const v = new Validator();
    const status = req.body.status ? v.oneOf(req.body.status, 'status', PURCHASE_STATUSES) : undefined;
    const paymentStatus = req.body.paymentStatus ? v.oneOf(req.body.paymentStatus, 'paymentStatus', PAYMENT_STATUSES) : undefined;
    const paymentMethod = req.body.paymentMethod ? v.oneOf(req.body.paymentMethod, 'paymentMethod', PAYMENT_METHODS) : undefined;
    const amountPaidGiven = req.body.amountPaid !== undefined && req.body.amountPaid !== null;
    const amountPaid = amountPaidGiven ? v.number(req.body.amountPaid, 'amountPaid', { min: 0 }) : null;
    const expectedDateGiven = req.body.expectedDate !== undefined;
    const expectedDate = v.date(req.body.expectedDate, 'expectedDate');
    const notes = req.body.notes === undefined ? undefined : v.optionalString(req.body.notes, 'notes');
    v.throwIfAny();

    const existing = await prisma.purchase.findFirst({
      where: { id: purchaseId, userId: req.user.userId },
      include: { items: true },
    });

    if (!existing) return fail(req, res, 'PURCHASE_NOT_FOUND');

    // Enforce the status transition matrix (P5). Same-status is a no-op.
    // 'partial' / 'received' are owned by the receive endpoint.
    let newStatus: string | undefined;
    if (status && status !== existing.status) {
      if (RECEIVE_ONLY_STATUSES.includes(status)) {
        return fail(req, res, 'PURCHASE_STATUS_VIA_RECEIVE', { status });
      }
      const allowed = PURCHASE_STATUS_TRANSITIONS[existing.status];
      if (!allowed || !allowed.includes(status)) {
        return fail(req, res, 'PURCHASE_INVALID_TRANSITION', { from: existing.status, to: status });
      }
      newStatus = status;
    }

    const cancelling = newStatus === 'cancelled';

    // Cancelled is terminal: payments can no longer change
    if (existing.status === 'cancelled' && (amountPaid !== null || paymentStatus)) {
      return fail(req, res, 'PURCHASE_CANCELLED_PAYMENT_LOCKED');
    }

    const total = Number(existing.total);
    const currentPaid = Number(existing.amountPaid);

    // Resolve the new amountPaid (P4: amountPaid is the source of truth; the
    // payment status is derived). Cancelling forces amountPaid to 0 — the
    // automatic expense rows are removed and any supplier refund is a manual
    // caisse entry. Older clients only send a status — map it onto amountPaid.
    const touchingPayment = cancelling || amountPaid !== null || !!paymentStatus;
    let newPaid = currentPaid;
    if (cancelling) {
      newPaid = 0;
    } else if (amountPaid !== null) {
      newPaid = Math.min(Math.max(amountPaid, 0), Math.max(total, 0));
    } else if (paymentStatus === 'paid') {
      newPaid = Math.max(total, 0);
    } else if (paymentStatus === 'pending') {
      newPaid = 0;
    }
    // 'partial' without an explicit amount keeps the current amountPaid

    const derivedPaymentStatus = derivePaymentStatus(newPaid, total);
    const paymentChanged = newPaid !== currentPaid;

    const purchase = await prisma.$transaction(async (tx) => {
      // Cancel rollback (P5): return received stock with negative 'adjustment'
      // movements and reset receivedQty, all inside this transaction.
      if (cancelling) {
        // Parents whose quantity must be recalculated (sum of active variants)
        // once all lines are rolled back — batched per product
        const productsToRecalc = new Set<string>();

        for (const item of existing.items) {
          if (item.receivedQty <= 0) continue;

          // Variant lines take the stock back from the VARIANT. The
          // conditional updateMany guards against driving the variant
          // negative when part of the received stock was already sold — in
          // that case fall back to the parent so the cancel still completes
          // (the ledger note records the anomaly; a human sorts out the
          // physical stock).
          let rolledBackViaVariant = false;
          if (item.variantId) {
            const rolledBack = await tx.productVariant.updateMany({
              where: {
                id: item.variantId,
                productId: item.productId,
                quantity: { gte: item.receivedQty },
              },
              data: { quantity: { decrement: item.receivedQty } },
            });
            rolledBackViaVariant = rolledBack.count === 1;
            if (rolledBackViaVariant) productsToRecalc.add(item.productId);
          }
          if (!rolledBackViaVariant) {
            await tx.product.update({
              where: { id: item.productId },
              data: { quantity: { decrement: item.receivedQty } },
            });
          }

          await tx.stockMovement.create({
            data: {
              userId: req.user!.userId,
              productId: item.productId,
              // variantId stays null on the fallback: the variant's own
              // quantity was NOT touched, only the parent-visible total moved
              variantId: rolledBackViaVariant ? item.variantId : null,
              type: 'adjustment',
              quantity: -item.receivedQty,
              reference: purchaseId,
              reason: `Purchase ${existing.purchaseNumber} cancelled`,
              ...(item.variantId && !rolledBackViaVariant && {
                notes: `Variant "${item.variantName || item.variantId}" stock already consumed — decremented parent product instead`,
              }),
            },
          });

          await tx.purchaseItem.update({
            where: { id: item.id },
            data: { receivedQty: 0 },
          });
        }

        // Parent quantity = sum of active variants, recalculated in the tx.
        // Fallback lines are intentionally NOT recalced: the recalc would
        // overwrite their parent-level correction.
        for (const productId of productsToRecalc) {
          await recalcParentQuantity(tx, productId);
        }
      }

      const updated = await tx.purchase.update({
        where: { id: purchaseId },
        data: {
          ...(newStatus && { status: newStatus }),
          ...(touchingPayment && { amountPaid: newPaid, paymentStatus: derivedPaymentStatus }),
          ...(paymentMethod && { paymentMethod }),
          ...(expectedDateGiven && { expectedDate }),
          ...(notes !== undefined && { notes }),
        },
        include: { supplier: true, items: true },
      });

      // Recompute the automatic caisse rows whenever the cash paid changes
      // (up OR down) or the purchase is cancelled: delete the automatic rows
      // for this purchase, then post ONE expense row for the current amount.
      // Manual rows are never touched.
      if (paymentChanged || cancelling) {
        await tx.caisseTransaction.deleteMany({
          where: {
            userId: req.user!.userId,
            sourceId: purchaseId,
            category: 'purchase',
            isAutomatic: true,
          },
        });
        if (newPaid > 0) {
          await tx.caisseTransaction.create({
            data: {
              userId: req.user!.userId,
              type: 'expense',
              amount: newPaid,
              category: 'purchase',
              reference: updated.purchaseNumber,
              description: `Purchase ${updated.purchaseNumber}`,
              date: new Date(),
              isAutomatic: true,
              sourceId: purchaseId,
            },
          });
        }
      }

      return updated;
    });

    res.json({
      purchase,
      ...(cancelling && currentPaid > 0 && {
        note: 'Automatic caisse expenses for this purchase were removed. Record any supplier refund manually in the caisse.',
      }),
    });
  } catch (error) {
    return handleError(req, res, error, 'PURCHASE_UPDATE_FAILED');
  }
};

// ============================================================================
// Delete Purchase
// ============================================================================

export const deletePurchase = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const purchaseId = req.params.purchaseId as string;

    const purchase = await prisma.purchase.findFirst({
      where: { id: purchaseId, userId: req.user.userId },
      include: { items: true },
    });

    if (!purchase) return fail(req, res, 'PURCHASE_NOT_FOUND');

    if (purchase.status !== 'pending') {
      return fail(req, res, 'PURCHASE_DELETE_NOT_PENDING', { status: purchase.status });
    }

    // P5: deletion requires amountPaid = 0 (cash already moved must be
    // compensated through updatePurchase/cancel, never silently deleted).
    // A zero-total purchase is derived 'paid' with amountPaid = 0 — deletable.
    if (Number(purchase.amountPaid) > 0) {
      return fail(req, res, purchase.paymentStatus === 'paid' ? 'PURCHASE_DELETE_PAID' : 'PURCHASE_DELETE_WITH_PAYMENTS');
    }

    // Defense-in-depth: a pending purchase should never have received stock
    if (purchase.items.some((i) => i.receivedQty > 0)) {
      return fail(req, res, 'PURCHASE_DELETE_WITH_RECEIVED');
    }

    // Delete related automatic caisse transactions and purchase (manual rows survive)
    await prisma.$transaction(async (tx) => {
      await tx.caisseTransaction.deleteMany({
        where: { userId: req.user!.userId, sourceId: purchaseId, isAutomatic: true },
      });
      await tx.purchase.delete({ where: { id: purchaseId } });
    });

    res.json({ success: true });
  } catch (error) {
    return handleError(req, res, error, 'PURCHASE_DELETE_FAILED');
  }
};

// ============================================================================
// Receive Purchase Items
// ============================================================================

export const receivePurchaseItems = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const purchaseId = req.params.purchaseId as string;
    // Array of { itemId, receivedQty } — receivedQty is the DELTA received NOW
    // (matches the 'Receive Now' input in the UI), NOT a cumulative value (P5).
    const v = new Validator();
    const rawItems = v.nonEmptyArray<any>(req.body.items, 'items', 'item');
    // Validate deltas up-front: must be non-negative integers (0 = no-op line)
    const items = rawItems.map((item, i) => ({
      itemId: v.id(item?.itemId, `items[${i}].itemId`),
      receivedQty: v.integer(item?.receivedQty, `items[${i}].receivedQty`, { min: 0 }),
    }));
    v.throwIfAny();

    const purchase = await prisma.purchase.findFirst({
      where: { id: purchaseId, userId: req.user.userId },
    });

    if (!purchase) return fail(req, res, 'PURCHASE_NOT_FOUND');

    if (purchase.status === 'cancelled') return fail(req, res, 'PURCHASE_RECEIVE_CANCELLED');

    if (purchase.status === 'received') return fail(req, res, 'PURCHASE_ALREADY_RECEIVED');

    // Process receiving in transaction
    const updatedPurchase = await prisma.$transaction(async (tx) => {
      // Parents whose quantity must be recalculated (sum of active variants)
      // once all lines are processed — batched per product
      const productsToRecalc = new Set<string>();

      for (const item of items) {
        const delta = item.receivedQty;
        if (delta === 0) continue;

        // Re-read inside the transaction (never trust a pre-transaction
        // snapshot — fixes the concurrent-receive race)
        const purchaseItem = await tx.purchaseItem.findFirst({
          where: { id: item.itemId as string, purchaseId },
        });
        // An itemId that belongs to another purchase (or to nothing) is a
        // client bug, not a no-op: silently ignoring it made the caller
        // believe the goods were received.
        if (!purchaseItem) throw new ApiError('PURCHASE_ITEM_NOT_FOUND');

        if (purchaseItem.receivedQty + delta > purchaseItem.quantity) {
          const remaining = purchaseItem.quantity - purchaseItem.receivedQty;
          throw new ApiError('PURCHASE_OVER_RECEIVE', {
            product: purchaseItem.productName,
            delta,
            remaining,
          });
        }

        // Conditional increment: guards against a concurrent receive pushing
        // the received quantity past the ordered quantity
        const result = await tx.purchaseItem.updateMany({
          where: {
            id: item.itemId as string,
            purchaseId,
            receivedQty: { lte: purchaseItem.quantity - delta },
          },
          data: { receivedQty: { increment: delta } },
        });
        if (result.count !== 1) {
          throw new ApiError('PURCHASE_CONCURRENT_RECEIVE', { product: purchaseItem.productName });
        }

        // Update stock: variant lines restock the VARIANT (the parent is
        // recalculated as the sum of active variants at the end of the tx —
        // incrementing the parent directly would be erased by the next
        // variant transaction). If the variant vanished since the purchase
        // was placed, fall back to restocking the parent directly.
        let restockedViaVariant = false;
        if (purchaseItem.variantId) {
          const restocked = await tx.productVariant.updateMany({
            where: { id: purchaseItem.variantId, productId: purchaseItem.productId },
            data: { quantity: { increment: delta } },
          });
          restockedViaVariant = restocked.count === 1;
          if (restockedViaVariant) productsToRecalc.add(purchaseItem.productId);
        }
        if (!restockedViaVariant) {
          await tx.product.update({
            where: { id: purchaseItem.productId },
            data: { quantity: { increment: delta } },
          });
        }

        // Create stock movement ('in' rows carry a positive quantity)
        await tx.stockMovement.create({
          data: {
            userId: req.user!.userId,
            productId: purchaseItem.productId,
            variantId: restockedViaVariant ? purchaseItem.variantId : null,
            type: 'in',
            quantity: delta,
            reference: purchaseId,
            reason: `Purchase ${purchase.purchaseNumber}`,
            ...(purchaseItem.variantId && !restockedViaVariant && {
              notes: `Variant "${purchaseItem.variantName || purchaseItem.variantId}" no longer exists — restocked parent product instead`,
            }),
          },
        });
      }

      // Parent quantity = sum of active variants, recalculated in the tx
      for (const productId of productsToRecalc) {
        await recalcParentQuantity(tx, productId);
      }

      // Check if all items are fully received (from the post-update rows)
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
    return handleError(req, res, error, 'PURCHASE_RECEIVE_FAILED');
  }
};

// ============================================================================
// Purchase Stats
// ============================================================================

export const getPurchaseStats = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const { period = 'month' } = req.query;

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
        startDate = new Date(now.setMonth(now.getMonth() - 1));
    }

    // Cancelled purchases never count in stats (P6)
    const where = {
      userId: req.user.userId,
      purchaseDate: { gte: startDate },
      status: { not: 'cancelled' },
    };

    const [
      totalPurchases,
      totals,
      pendingPurchases,
      receivedPurchases,
      topSuppliers,
    ] = await Promise.all([
      prisma.purchase.count({ where }),
      prisma.purchase.aggregate({
        where,
        _sum: { total: true, amountPaid: true },
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
        // Cash actually paid out (P6); committedTotal is the full ordered value
        totalSpent: Number(totals._sum.amountPaid) || 0,
        committedTotal: Number(totals._sum.total) || 0,
        pendingPurchases,
        receivedPurchases,
      },
      topSuppliers: topSuppliersWithNames,
    });
  } catch (error) {
    return handleError(req, res, error, 'PURCHASE_STATS_FAILED');
  }
};
