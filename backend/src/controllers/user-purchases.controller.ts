import { Request, Response } from 'express';
import prisma from '../config/database';
import { recalcParentQuantity } from './user-product-variants.controller';

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// Payment status is DERIVED server-side from the cash actually paid out (P4):
// 0 -> pending, >= total -> paid, else partial.
const derivePaymentStatus = (amountPaid: number, total: number): string => {
  if (amountPaid <= 0) return total <= 0 ? 'paid' : 'pending';
  return amountPaid >= total ? 'paid' : 'partial';
};

const VALID_PAYMENT_STATUSES = ['pending', 'partial', 'paid'];

// Status transition matrix (P5): received and cancelled are terminal.
const PURCHASE_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['partial', 'received', 'cancelled'],
  partial: ['received', 'cancelled'],
  received: [],
  cancelled: [],
};

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
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      startDate,
      endDate,
      status,
      paymentStatus,
      supplierId,
      search,
      minTotal,
      maxTotal,
      hasRemaining,
      limit = '50',
      offset = '0'
    } = req.query;

    const where: any = { userId: req.user.userId };

    if (startDate || endDate) {
      where.purchaseDate = {};
      if (startDate) where.purchaseDate.gte = new Date(startDate as string);
      if (endDate) where.purchaseDate.lte = new Date(endDate as string);
    }

    if (status) where.status = status as string;
    if (hasRemaining === 'true') {
      where.paymentStatus = { not: 'paid' };
      // Cancelled purchases are not money owed
      if (!status) where.status = { not: 'cancelled' };
    } else if (paymentStatus) {
      where.paymentStatus = paymentStatus as string;
    }
    if (supplierId) where.supplierId = supplierId as string;

    if (search) {
      where.OR = [
        { purchaseNumber: { contains: search as string } },
        { notes: { contains: search as string } },
        { supplier: { name: { contains: search as string } } },
      ];
    }

    if (minTotal || maxTotal) {
      where.total = {};
      if (minTotal) where.total.gte = parseFloat(minTotal as string);
      if (maxTotal) where.total.lte = parseFloat(maxTotal as string);
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
        skip: parseInt(offset as string, 10),
        take: parseInt(limit as string, 10),
      }),
      prisma.purchase.count({ where }),
    ]);

    res.json({ purchases, total });
  } catch (error) {
    console.error('Get purchases error:', error);
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
};

export const getPurchase = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

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

    if (!purchase) {
      res.status(404).json({ error: 'Purchase not found' });
      return;
    }

    res.json({ purchase });
  } catch (error) {
    console.error('Get purchase error:', error);
    res.status(500).json({ error: 'Failed to fetch purchase' });
  }
};

export const createPurchase = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // NOTE: `status` is intentionally NOT accepted from the client — new purchases
    // always start 'pending'; 'partial'/'received' are owned by receivePurchaseItems
    // and 'cancelled' by updatePurchase (P5).
    const {
      supplierId,
      items,
      tax = 0,
      shippingCost = 0,
      paymentStatus = 'pending',
      paymentMethod = 'cash',
      amountPaid,
      purchaseDate,
      expectedDate,
      notes,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'At least one item is required' });
      return;
    }

    if (!VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
      res.status(400).json({ error: 'Invalid payment status' });
      return;
    }

    // Optional purchase date (must not be more than 1 day in the future)
    let purchaseDateValue: Date | undefined;
    if (purchaseDate !== undefined && purchaseDate !== null && purchaseDate !== '') {
      const parsed = new Date(purchaseDate);
      if (isNaN(parsed.getTime())) {
        res.status(400).json({ error: 'Invalid purchase date' });
        return;
      }
      if (parsed.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
        res.status(400).json({ error: 'Purchase date cannot be in the future' });
        return;
      }
      purchaseDateValue = parsed;
    }

    // Verify all products exist (items may repeat a product across variants)
    const productIds: string[] = items.map((item: any) => item.productId);
    const uniqueProductIds = Array.from(new Set(productIds));
    const products = await prisma.product.findMany({
      where: { id: { in: uniqueProductIds }, userId: req.user.userId },
      include: { variants: true },
    });

    if (products.length !== uniqueProductIds.length) {
      res.status(400).json({ error: 'One or more products not found' });
      return;
    }

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

    for (const item of items) {
      const product = products.find((p) => p.id === item.productId)!;

      let variant: (typeof product.variants)[number] | null = null;
      if (product.hasVariants) {
        if (!item.variantId) {
          res.status(400).json({ error: `Variant is required for product: ${product.name}` });
          return;
        }
        variant = product.variants.find((v) => v.id === item.variantId) || null;
        if (!variant || !variant.isActive) {
          res.status(400).json({ error: `Variant not found for product: ${product.name}` });
          return;
        }
      }

      // `??` (not `||`): an explicit 0 unit cost is legal (e.g. free samples)
      const unitCost = Number(
        item.unitCost ?? (variant ? variant.costPrice : product.costPrice)
      );
      const itemTotal = unitCost * item.quantity;
      subtotal += itemTotal;

      purchaseItems.push({
        productId: product.id,
        productName: product.name,
        variantId: variant ? variant.id : null,
        variantName: variant ? variant.name : null,
        quantity: item.quantity,
        unitCost,
        total: itemTotal,
      });
    }

    const total = subtotal + tax + shippingCost;

    // Clamp amountPaid and derive payment status server-side (P4). Older clients
    // only send paymentStatus — map it onto amountPaid for backward compatibility.
    let paid: number;
    if (amountPaid !== undefined && amountPaid !== null) {
      const requested = Number(amountPaid);
      if (isNaN(requested)) {
        res.status(400).json({ error: 'Invalid amountPaid' });
        return;
      }
      paid = Math.min(Math.max(requested, 0), Math.max(total, 0));
    } else {
      paid = paymentStatus === 'paid' ? Math.max(total, 0) : 0;
    }
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
              expectedDate: expectedDate ? new Date(expectedDate) : null,
              notes: notes?.trim() || null,
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
    console.error('Create purchase error:', error);
    res.status(500).json({ error: 'Failed to create purchase' });
  }
};

export const updatePurchase = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const purchaseId = req.params.purchaseId as string;
    const { paymentStatus, status, expectedDate, notes, amountPaid, paymentMethod } = req.body;

    const existing = await prisma.purchase.findFirst({
      where: { id: purchaseId, userId: req.user.userId },
      include: { items: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Purchase not found' });
      return;
    }

    // Enforce the status transition matrix (P5). Same-status is a no-op.
    let newStatus: string | undefined;
    if (status && status !== existing.status) {
      const allowed = PURCHASE_STATUS_TRANSITIONS[existing.status];
      if (!allowed || !allowed.includes(status)) {
        res.status(400).json({
          error: `Cannot change purchase status from '${existing.status}' to '${status}'`,
        });
        return;
      }
      newStatus = status;
    }

    const cancelling = newStatus === 'cancelled';

    // Cancelled is terminal: payments can no longer change
    if (existing.status === 'cancelled' && ((amountPaid !== undefined && amountPaid !== null) || paymentStatus)) {
      res.status(400).json({ error: 'Cannot modify payments on a cancelled purchase' });
      return;
    }

    if (paymentStatus && !VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
      res.status(400).json({ error: 'Invalid payment status' });
      return;
    }

    const total = Number(existing.total);
    const currentPaid = Number(existing.amountPaid);

    // Resolve the new amountPaid (P4: amountPaid is the source of truth; the
    // payment status is derived). Cancelling forces amountPaid to 0 — the
    // automatic expense rows are removed and any supplier refund is a manual
    // caisse entry. Older clients only send a status — map it onto amountPaid.
    const touchingPayment =
      cancelling || (amountPaid !== undefined && amountPaid !== null) || !!paymentStatus;
    let newPaid = currentPaid;
    if (cancelling) {
      newPaid = 0;
    } else if (amountPaid !== undefined && amountPaid !== null) {
      const requested = Number(amountPaid);
      if (isNaN(requested)) {
        res.status(400).json({ error: 'Invalid amountPaid' });
        return;
      }
      newPaid = Math.min(Math.max(requested, 0), Math.max(total, 0));
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
          ...(expectedDate !== undefined && {
            expectedDate: expectedDate ? new Date(expectedDate) : null,
          }),
          ...(notes !== undefined && { notes: notes?.trim() || null }),
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
    console.error('Update purchase error:', error);
    res.status(500).json({ error: 'Failed to update purchase' });
  }
};

// ============================================================================
// Delete Purchase
// ============================================================================

export const deletePurchase = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const purchaseId = req.params.purchaseId as string;

    const purchase = await prisma.purchase.findFirst({
      where: { id: purchaseId, userId: req.user.userId },
      include: { items: true },
    });

    if (!purchase) {
      res.status(404).json({ error: 'Purchase not found' });
      return;
    }

    if (purchase.status !== 'pending') {
      res.status(400).json({ error: 'Can only delete pending purchases' });
      return;
    }

    if (purchase.paymentStatus === 'paid') {
      res.status(400).json({ error: 'Cannot delete a paid purchase' });
      return;
    }

    // P5: deletion requires amountPaid = 0 (cash already moved must be
    // compensated through updatePurchase/cancel, never silently deleted)
    if (Number(purchase.amountPaid) > 0) {
      res.status(400).json({ error: 'Cannot delete a purchase with recorded payments' });
      return;
    }

    // Defense-in-depth: a pending purchase should never have received stock
    if (purchase.items.some((i) => i.receivedQty > 0)) {
      res.status(400).json({ error: 'Cannot delete a purchase with received items' });
      return;
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
    console.error('Delete purchase error:', error);
    res.status(500).json({ error: 'Failed to delete purchase' });
  }
};

// ============================================================================
// Receive Purchase Items
// ============================================================================

export const receivePurchaseItems = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const purchaseId = req.params.purchaseId as string;
    // Array of { itemId, receivedQty } — receivedQty is the DELTA received NOW
    // (matches the 'Receive Now' input in the UI), NOT a cumulative value (P5).
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Items to receive are required' });
      return;
    }

    // Validate deltas up-front: must be non-negative integers (0 = no-op line)
    for (const item of items) {
      const delta = Number(item.receivedQty);
      if (!Number.isInteger(delta) || delta < 0) {
        res.status(400).json({ error: 'Received quantity must be a non-negative whole number' });
        return;
      }
    }

    const purchase = await prisma.purchase.findFirst({
      where: { id: purchaseId, userId: req.user.userId },
    });

    if (!purchase) {
      res.status(404).json({ error: 'Purchase not found' });
      return;
    }

    if (purchase.status === 'cancelled') {
      res.status(400).json({ error: 'Cannot receive items into a cancelled purchase' });
      return;
    }

    if (purchase.status === 'received') {
      res.status(400).json({ error: 'Purchase is already fully received' });
      return;
    }

    // Process receiving in transaction
    const updatedPurchase = await prisma.$transaction(async (tx) => {
      // Parents whose quantity must be recalculated (sum of active variants)
      // once all lines are processed — batched per product
      const productsToRecalc = new Set<string>();

      for (const item of items) {
        const delta = Number(item.receivedQty);
        if (delta === 0) continue;

        // Re-read inside the transaction (never trust a pre-transaction
        // snapshot — fixes the concurrent-receive race)
        const purchaseItem = await tx.purchaseItem.findFirst({
          where: { id: item.itemId, purchaseId },
        });
        if (!purchaseItem) continue;

        if (purchaseItem.receivedQty + delta > purchaseItem.quantity) {
          const remaining = purchaseItem.quantity - purchaseItem.receivedQty;
          const err: any = new Error(
            `Cannot receive ${delta} more for "${purchaseItem.productName}": only ${remaining} remaining`,
          );
          err.code = 'OVER_RECEIVE';
          throw err;
        }

        // Conditional increment: guards against a concurrent receive pushing
        // the received quantity past the ordered quantity
        const result = await tx.purchaseItem.updateMany({
          where: {
            id: item.itemId,
            purchaseId,
            receivedQty: { lte: purchaseItem.quantity - delta },
          },
          data: { receivedQty: { increment: delta } },
        });
        if (result.count !== 1) {
          const err: any = new Error(
            `Another receive is in progress for "${purchaseItem.productName}" — please retry`,
          );
          err.code = 'CONCURRENT_RECEIVE';
          throw err;
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
  } catch (error: any) {
    if (error?.code === 'OVER_RECEIVE') {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error?.code === 'CONCURRENT_RECEIVE') {
      res.status(409).json({ error: error.message });
      return;
    }
    console.error('Receive purchase items error:', error);
    res.status(500).json({ error: 'Failed to receive items' });
  }
};

// ============================================================================
// Purchase Stats
// ============================================================================

export const getPurchaseStats = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

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
    console.error('Get purchase stats error:', error);
    res.status(500).json({ error: 'Failed to fetch purchase stats' });
  }
};
