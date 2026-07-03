import { Request, Response } from 'express';
import prisma from '../config/database';
import { computeDeliveryFee } from './user-delivery-fees.controller';
import { recalcParentQuantity } from './user-product-variants.controller';

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Thrown inside a stock transaction when a conditional decrement finds
 * insufficient quantity. The transaction rolls back and the HTTP handler
 * maps this to a 400 instead of a generic 500.
 */
class InsufficientStockError extends Error {
  constructor(public productLabel: string) {
    super(`Insufficient stock for product: ${productLabel}`);
    this.name = 'InsufficientStockError';
  }
}

/**
 * Order status transition matrix (backend-enforced).
 * cancelled/returned are TERMINAL: resurrection is forbidden — create a new
 * order instead. Same-status updates are no-ops and always allowed.
 */
const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'],
  confirmed: ['preparing', 'shipped', 'delivered', 'cancelled'],
  preparing: ['shipped', 'delivered', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
};

/**
 * Statuses from which an order may still be auto-cancelled (rejected call,
 * AI cancel tool). Shared so every cancel path applies the same guard.
 */
export const CANCELLABLE_STATUSES = ['pending', 'confirmed', 'preparing'];

/**
 * Roll back the side-effects of a confirmed/pending order when it transitions
 * to `cancelled` or `returned`. Idempotent for the actual cancellation, but
 * the caller must ensure this only fires once per transition (the bug we keep
 * hitting: this fires zero or many times depending on which controller path
 * the user took to cancel).
 *
 * What it does inside the supplied transaction:
 *   1. Re-increments stock for every order line (variant stock when the line
 *      carries a variantId, then parent qty is recalculated as the sum of
 *      active variants; plain product stock otherwise)
 *   2. Logs a `return` movement per line (audit trail visible on /movements)
 *   3. Wipes automatic caisse income rows tied to this order so revenue +
 *      caisse balance no longer count phantom money
 *   4. Rolls back the linked Client's lifetime `totalOrders` / `totalSpent`
 *   5. Zeroes the order's `amountPaid` and resets payment to `pending`
 */
export async function rollbackOrderSideEffects(
  tx: TxClient,
  userId: string,
  order: {
    id: string;
    orderNumber: string;
    total: any;
    clientId: string | null;
    items: { productId: string; variantId?: string | null; quantity: number }[];
  },
  reason: 'cancelled' | 'returned'
): Promise<void> {
  const productsToRecalc = new Set<string>();
  for (const item of order.items) {
    // Variant lines restore the variant, then the parent is recalculated as
    // the sum of active variants. If the variant vanished since the order was
    // placed, fall back to restoring the parent directly.
    let restoredViaVariant = false;
    if (item.variantId) {
      const restored = await tx.productVariant.updateMany({
        where: { id: item.variantId, productId: item.productId },
        data: { quantity: { increment: item.quantity } },
      });
      restoredViaVariant = restored.count === 1;
      if (restoredViaVariant) productsToRecalc.add(item.productId);
    }
    if (!restoredViaVariant) {
      await tx.product.update({
        where: { id: item.productId },
        data: { quantity: { increment: item.quantity } },
      });
    }
    await tx.stockMovement.create({
      data: {
        userId,
        productId: item.productId,
        variantId: item.variantId || null,
        type: 'return',
        quantity: item.quantity,
        reference: order.id,
        reason: `${reason === 'returned' ? 'Returned' : 'Cancelled'} order ${order.orderNumber}`,
      },
    });
  }
  for (const productId of productsToRecalc) {
    await recalcParentQuantity(tx, productId);
  }
  await tx.caisseTransaction.deleteMany({
    where: { userId, sourceId: order.id, isAutomatic: true },
  });
  if (order.clientId) {
    await tx.client.update({
      where: { id: order.clientId },
      data: {
        totalOrders: { decrement: 1 },
        totalSpent: { decrement: Number(order.total) },
      },
    });
  }
}

/**
 * Generate the next sequential order number (ORD-YYYYMMDD-XXXX) inside a
 * transaction. Shared by manual orders and the AI create_order tool so both
 * draw from the SAME sequence.
 *
 * Contract for callers: run inside prisma.$transaction and retry the whole
 * transaction on Prisma error P2002 (unique [userId, orderNumber]) — two
 * concurrent transactions can compute the same sequence number; the loser's
 * order.create hits the unique constraint. See createOrder's retry loop.
 */
export const generateOrderNumber = async (
  tx: TxClient,
  userId: string
): Promise<string> => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

  const lastOrder = await tx.order.findFirst({
    where: {
      userId,
      orderNumber: { startsWith: `ORD-${dateStr}` },
    },
    orderBy: { orderNumber: 'desc' },
  });

  let sequence = 1;
  if (lastOrder) {
    const lastSeq = parseInt(lastOrder.orderNumber.split('-')[2], 10);
    sequence = lastSeq + 1;
  }

  return `ORD-${dateStr}-${sequence.toString().padStart(4, '0')}`;
};

// ============================================================================
// Get Orders (list)
// ============================================================================

export const getOrders = async (req: Request, res: Response): Promise<void> => {
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
      confirmationStatus,
      deliveryStatus,
      search,
      minTotal,
      maxTotal,
      hasRemaining,
      clientId,
      limit = '50',
      offset = '0',
    } = req.query;

    const where: any = { userId: req.user.userId };

    if (clientId) where.clientId = clientId as string;

    if (startDate || endDate) {
      where.orderDate = {};
      if (startDate) where.orderDate.gte = new Date(startDate as string);
      if (endDate) where.orderDate.lte = new Date(endDate as string);
    }

    if (status) where.status = status as string;
    if (hasRemaining === 'true') {
      where.paymentStatus = { not: 'paid' };
    } else if (paymentStatus) {
      where.paymentStatus = paymentStatus as string;
    }
    if (confirmationStatus) where.confirmationStatus = confirmationStatus as string;
    if (deliveryStatus) where.deliveryStatus = deliveryStatus as string;

    if (minTotal || maxTotal) {
      where.total = {};
      if (minTotal) where.total.gte = parseFloat(minTotal as string);
      if (maxTotal) where.total.lte = parseFloat(maxTotal as string);
    }

    if (search) {
      const s = search as string;
      where.OR = [
        { orderNumber: { contains: s } },
        { clientName: { contains: s } },
        { clientPhone: { contains: s } },
        { clientAddress: { contains: s } },
        { notes: { contains: s } },
        { items: { some: { productName: { contains: s } } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
          calls: {
            orderBy: { calledAt: 'desc' },
            take: 5,
          },
          client: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { orderDate: 'desc' },
        skip: parseInt(offset as string, 10),
        take: parseInt(limit as string, 10),
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ orders, total });
  } catch (error: any) {
    console.error('Get orders error:', error.message, error.code, error.meta);
    res.status(500).json({ error: 'Failed to fetch orders', details: error.message });
  }
};

// ============================================================================
// Get Single Order
// ============================================================================

export const getOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const orderId = req.params.orderId as string;

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: req.user.userId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, imageUrl: true } },
          },
        },
        calls: {
          orderBy: { calledAt: 'desc' },
        },
        client: true,
      },
    });

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    res.json({ order });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
};

// ============================================================================
// Create Order
// ============================================================================

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      clientId,
      clientName,
      clientPhone,
      clientAddress,
      items,
      discount = 0,
      tax = 0,
      amountPaid = 0,
      paymentMethod = 'cash',
      status = 'pending',
      source = 'manual',
      notes,
      wilayaId,
      communeName,
      isStopdesk = false,
      deliveryFee: providedDeliveryFee,
      orderDate,
    } = req.body;

    if (!clientName || !clientName.trim()) {
      res.status(400).json({ error: 'Client name is required' });
      return;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'At least one item is required' });
      return;
    }

    // Optional explicit order date (backdated entries). Reject dates more
    // than one day in the future.
    let effectiveOrderDate = new Date();
    if (orderDate !== undefined && orderDate !== null && orderDate !== '') {
      const parsedDate = new Date(orderDate);
      if (isNaN(parsedDate.getTime())) {
        res.status(400).json({ error: 'Invalid order date' });
        return;
      }
      if (parsedDate.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
        res.status(400).json({ error: 'Order date cannot be in the future' });
        return;
      }
      effectiveOrderDate = parsedDate;
    }

    // Verify all products exist (items may repeat a product across variants)
    const productIds: string[] = items.map((item: any) => item.productId);
    const uniqueProductIds = Array.from(new Set(productIds));
    const products = await prisma.product.findMany({
      where: { id: { in: uniqueProductIds }, userId: req.user.userId, isActive: true },
      include: { variants: true },
    });

    if (products.length !== uniqueProductIds.length) {
      res.status(400).json({ error: 'One or more products not found' });
      return;
    }

    // Resolve lines: validate variants, check stock (fast-path friendly error —
    // the conditional decrement inside the transaction is authoritative) and
    // compute totals.
    let subtotal = 0;
    const orderItems: {
      productId: string;
      productName: string;
      variantId: string | null;
      variantName: string | null;
      quantity: number;
      unitPrice: number;
      discount: number;
      total: number;
    }[] = [];

    for (const item of items) {
      const product = products.find((p) => p.id === item.productId)!;
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        res.status(400).json({ error: `Invalid quantity for product: ${product.name}` });
        return;
      }

      let variant: (typeof product.variants)[number] | null = null;
      if (product.hasVariants) {
        // Variant products must say WHICH variant is being sold — otherwise
        // variant stock is never touched and any variant edit erases the
        // order's deduction (parent qty = sum of variants).
        if (!item.variantId) {
          res.status(400).json({ error: `Variant is required for product: ${product.name}` });
          return;
        }
        variant = product.variants.find((v) => v.id === item.variantId) || null;
        if (!variant || !variant.isActive) {
          res.status(400).json({ error: `Variant not found for product: ${product.name}` });
          return;
        }
        if (variant.quantity < quantity) {
          res.status(400).json({
            error: `Insufficient stock for product: ${product.name} (${variant.name})`,
          });
          return;
        }
      } else if (product.quantity < quantity) {
        res.status(400).json({ error: `Insufficient stock for product: ${product.name}` });
        return;
      }

      // `??` (not `||`) so an explicit unitPrice of 0 — a free item — is legal
      const unitPrice = Number(
        item.unitPrice ?? (variant ? variant.sellingPrice : product.sellingPrice)
      );
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        res.status(400).json({ error: `Invalid unit price for product: ${product.name}` });
        return;
      }
      const itemDiscount = Number(item.discount ?? 0) || 0;
      const itemTotal = unitPrice * quantity - itemDiscount;
      subtotal += itemTotal;

      orderItems.push({
        productId: product.id,
        productName: product.name,
        variantId: variant ? variant.id : null,
        variantName: variant ? variant.name : item.variantName || null,
        quantity,
        unitPrice,
        discount: itemDiscount,
        total: itemTotal,
      });
    }

    // Compute delivery fee: explicit override > auto-compute from wilaya
    let deliveryFee = 0;
    if (providedDeliveryFee !== undefined && providedDeliveryFee !== null && providedDeliveryFee !== '') {
      deliveryFee = Number(providedDeliveryFee) || 0;
    } else if (wilayaId) {
      try {
        const quote = await computeDeliveryFee(req.user.userId, Number(wilayaId), Boolean(isStopdesk));
        deliveryFee = quote.fee;
      } catch {
        deliveryFee = 0;
      }
    }

    const total = subtotal - discount + tax + deliveryFee;
    // Clamp: 0 <= amountPaid <= total; paymentStatus is always derived
    const actualPaid = Math.min(Math.max(0, Number(amountPaid) || 0), total);
    const computedPaymentStatus =
      actualPaid >= total ? 'paid' : actualPaid > 0 ? 'partial' : 'pending';

    // Create order and deduct stock in transaction
    const MAX_RETRIES = 3;
    let order;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        order = await prisma.$transaction(async (tx) => {
          const orderNumber = await generateOrderNumber(tx, req.user!.userId);

          const newOrder = await tx.order.create({
            data: {
              userId: req.user!.userId,
              orderNumber,
              clientId: clientId || null,
              clientName: clientName.trim(),
              clientPhone: clientPhone?.trim() || null,
              clientAddress: clientAddress?.trim() || null,
              subtotal,
              discount,
              tax,
              total,
              amountPaid: actualPaid,
              paymentMethod,
              paymentStatus: computedPaymentStatus,
              status,
              source,
              notes: notes?.trim() || null,
              wilayaId: wilayaId ? Number(wilayaId) : null,
              communeName: communeName?.trim() || null,
              isStopdesk: Boolean(isStopdesk),
              deliveryFee,
              orderDate: effectiveOrderDate,
              items: {
                create: orderItems,
              },
            },
            include: {
              items: true,
              calls: true,
            },
          });

          // Deduct stock atomically: the conditional updateMany (quantity >=
          // n) is the authoritative check — it kills the check-then-act race
          // where two concurrent orders both pass the pre-flight read and
          // drive stock negative. count !== 1 rolls the transaction back.
          const productsToRecalc = new Set<string>();
          for (const line of orderItems) {
            if (line.variantId) {
              const deducted = await tx.productVariant.updateMany({
                where: {
                  id: line.variantId,
                  productId: line.productId,
                  quantity: { gte: line.quantity },
                },
                data: { quantity: { decrement: line.quantity } },
              });
              if (deducted.count !== 1) {
                throw new InsufficientStockError(
                  `${line.productName} (${line.variantName})`
                );
              }
              productsToRecalc.add(line.productId);
            } else {
              const deducted = await tx.product.updateMany({
                where: {
                  id: line.productId,
                  userId: req.user!.userId,
                  quantity: { gte: line.quantity },
                },
                data: { quantity: { decrement: line.quantity } },
              });
              if (deducted.count !== 1) {
                throw new InsufficientStockError(line.productName);
              }
            }

            // Signed ledger: 'out' movements are NEGATIVE
            await tx.stockMovement.create({
              data: {
                userId: req.user!.userId,
                productId: line.productId,
                variantId: line.variantId,
                type: 'out',
                quantity: -line.quantity,
                reference: newOrder.id,
                reason: `Order ${orderNumber}`,
              },
            });
          }

          // Parent quantity = sum of active variants, recalculated in the tx
          for (const productId of productsToRecalc) {
            await recalcParentQuantity(tx, productId);
          }

          // Update client stats if linked
          if (clientId) {
            await tx.client.update({
              where: { id: clientId },
              data: {
                totalOrders: { increment: 1 },
                totalSpent: { increment: total },
                lastOrderDate: new Date(),
              },
            });
          }

          // Auto caisse entry if paid
          if (computedPaymentStatus === 'paid' || actualPaid > 0) {
            await tx.caisseTransaction.create({
              data: {
                userId: req.user!.userId,
                type: 'income',
                amount: actualPaid,
                category: 'order',
                reference: orderNumber,
                description: `Order ${orderNumber}`,
                date: effectiveOrderDate,
                isAutomatic: true,
                sourceId: newOrder.id,
              },
            });
          }

          return newOrder;
        });
        break;
      } catch (txError: any) {
        if (txError.code === 'P2002' && attempt < MAX_RETRIES - 1) {
          continue;
        }
        throw txError;
      }
    }

    res.status(201).json({ order });
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      res.status(400).json({
        error: `Insufficient stock for product: ${error.productLabel}`,
      });
      return;
    }
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
};

// ============================================================================
// Update Order (status, payment, delivery)
// ============================================================================

export const updateOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const orderId = req.params.orderId as string;
    const { status, paymentStatus, paymentMethod, deliveryStatus, amountPaid, notes, clientPhone, clientAddress } = req.body;

    const existing = await prisma.order.findFirst({
      where: { id: orderId, userId: req.user.userId },
      include: { items: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    // Enforce the status transition matrix (same-status is a no-op).
    // cancelled/returned are terminal — resurrection is forbidden.
    if (status !== undefined && status !== existing.status) {
      if (!(status in ORDER_STATUS_TRANSITIONS)) {
        res.status(400).json({ error: `Invalid status: ${status}` });
        return;
      }
      const allowedTargets = ORDER_STATUS_TRANSITIONS[existing.status] || [];
      if (!allowedTargets.includes(status)) {
        const terminal =
          existing.status === 'cancelled' || existing.status === 'returned';
        res.status(400).json({
          error: terminal
            ? `Order is ${existing.status} and cannot be changed. Create a new order instead.`
            : `Cannot change order status from '${existing.status}' to '${status}'.`,
        });
        return;
      }
    }

    // Terminal orders (cancelled/returned) had their stock restored and caisse
    // rows wiped — money/delivery fields must stay frozen or phantom income
    // reappears. Only notes remain editable.
    const isTerminal = existing.status === 'cancelled' || existing.status === 'returned';
    if (
      isTerminal &&
      (amountPaid !== undefined || paymentStatus !== undefined || paymentMethod !== undefined || deliveryStatus !== undefined)
    ) {
      res.status(400).json({
        error: `Order is ${existing.status} — payment and delivery fields cannot be modified.`,
      });
      return;
    }

    const updateData: any = {};
    let newPaid: number | null = null; // null = amountPaid unchanged
    let isAutoPay = false;

    if (amountPaid !== undefined) {
      const parsedPaid = Number(amountPaid);
      if (!Number.isFinite(parsedPaid)) {
        res.status(400).json({ error: 'amountPaid must be a number' });
        return;
      }
      // Clamp: 0 <= amountPaid <= total
      newPaid = Math.min(Math.max(0, parsedPaid), Number(existing.total));
    }

    if (status !== undefined) {
      updateData.status = status;
      // Auto-mark as paid when delivered (COD flow)
      if (status === 'delivered' && existing.paymentStatus !== 'paid') {
        newPaid = Number(existing.total);
        isAutoPay = true;
      }
    }
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (deliveryStatus !== undefined) updateData.deliveryStatus = deliveryStatus;
    if (notes !== undefined) updateData.notes = notes?.trim() || null;
    // Contact corrections from the call-confirmation modal
    if (clientPhone !== undefined) updateData.clientPhone = String(clientPhone).trim() || null;
    if (clientAddress !== undefined) updateData.clientAddress = String(clientAddress).trim() || null;

    // paymentStatus is DERIVED whenever amountPaid changes — a caller-supplied
    // value is only kept when amountPaid is untouched (backward compat).
    if (newPaid !== null) {
      updateData.amountPaid = newPaid;
      updateData.paymentStatus =
        newPaid >= Number(existing.total) ? 'paid' : newPaid > 0 ? 'partial' : 'pending';
    } else if (paymentStatus !== undefined) {
      updateData.paymentStatus = paymentStatus;
    }

    // A status transition to "cancelled" or "returned" should:
    //   - put the reserved stock back on the shelf
    //   - wipe automatic caisse income tied to this order
    // Without this, cancelled orders inflate revenue and leave stock missing.
    const becameInvalid =
      status !== undefined &&
      (status === 'cancelled' || status === 'returned') &&
      existing.status !== 'cancelled' &&
      existing.status !== 'returned';

    // Caisse recompute-on-change: automatic rows for this order must always
    // sum to the CURRENT amountPaid — covers raises, corrections downward and
    // the delivered auto-pay through the same path. Skipped on cancellation:
    // the rollback wipes the rows and forces amountPaid to 0.
    const paidChanged =
      !becameInvalid && newPaid !== null && newPaid !== Number(existing.amountPaid);
    const recomputedPaid = newPaid ?? 0;

    const order = await prisma.$transaction(async (tx) => {
      if (becameInvalid) {
        await rollbackOrderSideEffects(
          tx,
          req.user!.userId,
          existing,
          status as 'cancelled' | 'returned',
        );
        // Force amountPaid to zero on cancellation — caller can't have paid a
        // cancelled order; if they did, refund it manually via a caisse expense.
        updateData.amountPaid = 0;
        updateData.paymentStatus = 'pending';
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: updateData,
        include: {
          items: true,
          calls: { orderBy: { calledAt: 'desc' } },
        },
      });

      if (paidChanged) {
        await tx.caisseTransaction.deleteMany({
          where: { userId: req.user!.userId, sourceId: orderId, isAutomatic: true },
        });
        if (recomputedPaid > 0) {
          await tx.caisseTransaction.create({
            data: {
              userId: req.user!.userId,
              type: 'income',
              amount: recomputedPaid,
              category: 'order',
              reference: existing.orderNumber,
              description: `Order ${existing.orderNumber} payment${isAutoPay ? ' (COD - delivered)' : ''}`,
              date: new Date(),
              isAutomatic: true,
              sourceId: orderId,
            },
          });
        }
      }

      return updated;
    });

    res.json({ order });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
};

// ============================================================================
// Delete Order
// ============================================================================

export const deleteOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const orderId = req.params.orderId as string;

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: req.user.userId },
      include: { items: true },
    });

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    if (order.status === 'delivered') {
      res.status(400).json({ error: 'Cannot delete a delivered order' });
      return;
    }

    // Delete order. If the order is still "alive" (not already cancelled or
    // returned) we need to roll back stock + caisse + client stats. If it
    // was already cancelled, those side-effects were rolled back at
    // cancellation time, so doing it again would double-credit the stock.
    const alreadyRolledBack =
      order.status === 'cancelled' || order.status === 'returned';

    await prisma.$transaction(async (tx) => {
      if (!alreadyRolledBack) {
        const productsToRecalc = new Set<string>();
        for (const item of order.items) {
          // Variant lines restore the variant then recalc the parent; fall
          // back to the parent when the variant no longer exists.
          let restoredViaVariant = false;
          if (item.variantId) {
            const restored = await tx.productVariant.updateMany({
              where: { id: item.variantId, productId: item.productId },
              data: { quantity: { increment: item.quantity } },
            });
            restoredViaVariant = restored.count === 1;
            if (restoredViaVariant) productsToRecalc.add(item.productId);
          }
          if (!restoredViaVariant) {
            await tx.product.update({
              where: { id: item.productId },
              data: { quantity: { increment: item.quantity } },
            });
          }
          await tx.stockMovement.create({
            data: {
              userId: req.user!.userId,
              productId: item.productId,
              variantId: item.variantId || null,
              type: 'return',
              quantity: item.quantity,
              reference: order.id,
              reason: `Deleted order ${order.orderNumber}`,
            },
          });
        }
        for (const productId of productsToRecalc) {
          await recalcParentQuantity(tx, productId);
        }
        if (order.clientId) {
          await tx.client.update({
            where: { id: order.clientId },
            data: {
              totalOrders: { decrement: 1 },
              totalSpent: { decrement: Number(order.total) },
            },
          });
        }
      }

      // Always wipe caisse rows tied to this order, manual or not — the
      // order row itself is about to vanish, so referencing rows would
      // become orphaned.
      await tx.caisseTransaction.deleteMany({
        where: { userId: req.user!.userId, sourceId: orderId },
      });

      // Delete order (cascades to items and calls)
      await tx.order.delete({ where: { id: orderId } });
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ error: 'Failed to delete order' });
  }
};

// ============================================================================
// Add Call Record to Order
// ============================================================================

export const addOrderCall = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const orderId = req.params.orderId as string;
    const { result, notes } = req.body;

    if (!result) {
      res.status(400).json({ error: 'Call result is required' });
      return;
    }

    const validResults = ['picked_up', 'no_answer', 'busy', 'rejected', 'voicemail'];
    if (!validResults.includes(result)) {
      res.status(400).json({ error: `Invalid result. Must be one of: ${validResults.join(', ')}` });
      return;
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: req.user.userId },
      include: { items: true },
    });

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    // A picked-up call must NOT re-confirm a terminal order — cancelled and
    // returned are final. Log the call, return the order unchanged with a
    // warning so the UI can tell the employee to create a new order.
    if (
      result === 'picked_up' &&
      (order.status === 'cancelled' || order.status === 'returned')
    ) {
      const call = await prisma.orderCall.create({
        data: {
          orderId,
          result,
          notes: notes?.trim() || null,
        },
      });
      const unchangedOrder = await prisma.order.findFirst({
        where: { id: orderId, userId: req.user.userId },
        include: {
          items: true,
          calls: { orderBy: { calledAt: 'desc' } },
        },
      });
      res.json({
        call,
        order: unchangedOrder,
        warning: `Order is ${order.status} and was not re-confirmed. Create a new order instead.`,
      });
      return;
    }

    // Determine confirmation status based on call result
    let confirmationStatus = order.confirmationStatus;
    if (result === 'picked_up') {
      confirmationStatus = 'confirmed';
    } else if (result === 'rejected') {
      confirmationStatus = 'rejected';
    } else if (result === 'no_answer' || result === 'busy' || result === 'voicemail') {
      confirmationStatus = 'no_answer';
    }

    // If the rejection auto-cancels the order, we need the same rollback
    // (stock + caisse + client stats) that `updateOrder` performs. Without
    // this, the tester sees the order go to "cancelled" but stock stays
    // deducted — see StockDontIncreaseWhenOrderCancel.png in v2 bug report.
    // Auto-cancel ONLY while the order is still cancellable and the parcel
    // has not left (not_sent): a rejected follow-up call on a shipped or
    // delivered order must never re-shelve goods that are with the customer
    // or erase collected COD income — that requires the explicit returned flow.
    const willCancel =
      result === 'rejected' &&
      CANCELLABLE_STATUSES.includes(order.status) &&
      order.deliveryStatus === 'not_sent';

    const updatedOrder = await prisma.$transaction(async (tx) => {
      await tx.orderCall.create({
        data: {
          orderId,
          result,
          notes: notes?.trim() || null,
        },
      });

      if (willCancel) {
        await rollbackOrderSideEffects(tx, req.user!.userId, order, 'cancelled');
      }

      return tx.order.update({
        where: { id: orderId },
        data: {
          confirmationStatus,
          callAttempts: { increment: 1 },
          // Auto-confirm order status if client picked up and confirmed
          ...(result === 'picked_up' && order.status === 'pending'
            ? { status: 'confirmed' }
            : {}),
          // Auto-cancel if rejected
          ...(willCancel ? { status: 'cancelled', amountPaid: 0, paymentStatus: 'pending' } : {}),
        },
        include: {
          items: true,
          calls: { orderBy: { calledAt: 'desc' } },
        },
      });
    });

    const call = updatedOrder.calls[0];
    res.json({ call, order: updatedOrder });
  } catch (error) {
    console.error('Add order call error:', error);
    res.status(500).json({ error: 'Failed to add call record' });
  }
};

// ============================================================================
// Get Order Calls
// ============================================================================

export const getOrderCalls = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const orderId = req.params.orderId as string;

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: req.user.userId },
      select: { id: true },
    });

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const calls = await prisma.orderCall.findMany({
      where: { orderId },
      orderBy: { calledAt: 'desc' },
    });

    res.json({ calls });
  } catch (error) {
    console.error('Get order calls error:', error);
    res.status(500).json({ error: 'Failed to fetch call records' });
  }
};

// ============================================================================
// Order Stats (for dashboard analytics)
// ============================================================================

export const getOrderStats = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { period = 'month' } = req.query;
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case 'year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    }

    const where = {
      userId: req.user.userId,
      orderDate: { gte: startDate },
    };

    // Revenue figures exclude cancelled + returned orders (their stock and
    // caisse rows were rolled back — counting them inflates the dashboard).
    // The status breakdown stays unfiltered so cancelled/returned counts show.
    const activeWhere = {
      ...where,
      status: { notIn: ['cancelled', 'returned'] },
    };

    const [totalOrders, totalRevenue, byStatus, byDeliveryStatus, topProducts] =
      await Promise.all([
        prisma.order.count({ where: activeWhere }),
        prisma.order.aggregate({
          where: activeWhere,
          _sum: { total: true },
        }),
        prisma.order.groupBy({
          by: ['status'],
          where,
          _count: { _all: true },
        }),
        prisma.order.groupBy({
          by: ['deliveryStatus'],
          where,
          _count: { _all: true },
        }),
        prisma.orderItem.groupBy({
          by: ['productId', 'productName'],
          where: { order: activeWhere },
          _sum: { quantity: true, total: true },
          orderBy: { _sum: { total: 'desc' } },
          take: 5,
        }),
      ]);

    const statusMap: Record<string, number> = {};
    for (const s of byStatus) {
      statusMap[s.status] = s._count._all;
    }

    const deliveryMap: Record<string, number> = {};
    for (const d of byDeliveryStatus) {
      deliveryMap[d.deliveryStatus] = d._count._all;
    }

    const paidOrders = await prisma.order.aggregate({
      where: { ...where, paymentStatus: 'paid' },
      _sum: { amountPaid: true },
      _count: { _all: true },
    });

    res.json({
      stats: {
        totalOrders,
        totalRevenue: Number(totalRevenue._sum.total || 0),
        paidOrders: paidOrders._count._all,
        paidAmount: Number(paidOrders._sum.amountPaid || 0),
        pending: statusMap['pending'] || 0,
        confirmed: statusMap['confirmed'] || 0,
        preparing: statusMap['preparing'] || 0,
        shipped: statusMap['shipped'] || 0,
        delivered: statusMap['delivered'] || 0,
        cancelled: statusMap['cancelled'] || 0,
        returned: statusMap['returned'] || 0,
        // Delivery pipeline counts (for the delivery page tabs)
        notSent: deliveryMap['not_sent'] || 0,
        sent: deliveryMap['sent'] || 0,
        inTransit: deliveryMap['in_transit'] || 0,
        deliveredDelivery: deliveryMap['delivered'] || 0,
        averageOrderValue: totalOrders > 0 ? Number(totalRevenue._sum.total || 0) / totalOrders : 0,
      },
      topProducts,
    });
  } catch (error) {
    console.error('Get order stats error:', error);
    res.status(500).json({ error: 'Failed to fetch order stats' });
  }
};
