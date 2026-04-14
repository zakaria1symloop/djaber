import { Request, Response } from 'express';
import prisma from '../config/database';

// Generate order number inside a transaction to avoid race conditions
const generateOrderNumber = async (
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
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
    } = req.body;

    if (!clientName || !clientName.trim()) {
      res.status(400).json({ error: 'Client name is required' });
      return;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'At least one item is required' });
      return;
    }

    // Verify all products exist
    const productIds = items.map((item: any) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, userId: req.user.userId, isActive: true },
    });

    if (products.length !== productIds.length) {
      res.status(400).json({ error: 'One or more products not found' });
      return;
    }

    // Check stock availability
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product || product.quantity < item.quantity) {
        res.status(400).json({
          error: `Insufficient stock for product: ${product?.name || 'Unknown'}`,
        });
        return;
      }
    }

    // Calculate totals
    let subtotal = 0;
    const orderItems = items.map((item: any) => {
      const product = products.find((p) => p.id === item.productId)!;
      const unitPrice = item.unitPrice || Number(product.sellingPrice);
      const itemDiscount = item.discount || 0;
      const itemTotal = unitPrice * item.quantity - itemDiscount;
      subtotal += itemTotal;

      return {
        productId: product.id,
        productName: product.name,
        variantId: item.variantId || null,
        variantName: item.variantName || null,
        quantity: item.quantity,
        unitPrice,
        discount: itemDiscount,
        total: itemTotal,
      };
    });

    const total = subtotal - discount + tax;
    const actualPaid = Math.min(Number(amountPaid), total);
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
              items: {
                create: orderItems,
              },
            },
            include: {
              items: true,
              calls: true,
            },
          });

          // Deduct stock for confirmed orders, or reserve stock for pending
          for (const item of items) {
            await tx.product.update({
              where: { id: item.productId },
              data: { quantity: { decrement: item.quantity } },
            });

            await tx.stockMovement.create({
              data: {
                userId: req.user!.userId,
                productId: item.productId,
                type: 'out',
                quantity: -item.quantity,
                reference: newOrder.id,
                reason: `Order ${orderNumber}`,
              },
            });
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
                date: new Date(),
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
    const { status, paymentStatus, paymentMethod, deliveryStatus, amountPaid, notes } = req.body;

    const existing = await prisma.order.findFirst({
      where: { id: orderId, userId: req.user.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const updateData: any = {};
    let autoPayAmount: number | null = null;

    if (status !== undefined) {
      updateData.status = status;
      // Auto-mark as paid when delivered (COD flow)
      if (status === 'delivered' && existing.paymentStatus !== 'paid') {
        updateData.paymentStatus = 'paid';
        updateData.amountPaid = existing.total;
        autoPayAmount = Number(existing.total) - Number(existing.amountPaid);
      }
    }
    if (paymentStatus !== undefined) updateData.paymentStatus = paymentStatus;
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (deliveryStatus !== undefined) updateData.deliveryStatus = deliveryStatus;
    if (amountPaid !== undefined) updateData.amountPaid = Number(amountPaid);
    if (notes !== undefined) updateData.notes = notes?.trim() || null;

    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: updateData,
        include: {
          items: true,
          calls: { orderBy: { calledAt: 'desc' } },
        },
      });

      // Auto caisse entry if amountPaid increased (manual or auto via delivery)
      const effectiveDelta = amountPaid !== undefined
        ? Number(amountPaid) - Number(existing.amountPaid)
        : (autoPayAmount && autoPayAmount > 0 ? autoPayAmount : 0);

      if (effectiveDelta > 0) {
        await tx.caisseTransaction.create({
          data: {
            userId: req.user!.userId,
            type: 'income',
            amount: effectiveDelta,
            category: 'order',
            reference: existing.orderNumber,
            description: `Order ${existing.orderNumber} payment${autoPayAmount ? ' (COD - delivered)' : ''}`,
            date: new Date(),
            isAutomatic: true,
            sourceId: orderId,
          },
        });
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

    // Delete order and restore stock
    await prisma.$transaction(async (tx) => {
      // Restore product quantities
      for (const item of order.items) {
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
            reference: order.id,
            reason: `Deleted order ${order.orderNumber}`,
          },
        });
      }

      // Revert client stats if linked
      if (order.clientId) {
        await tx.client.update({
          where: { id: order.clientId },
          data: {
            totalOrders: { decrement: 1 },
            totalSpent: { decrement: Number(order.total) },
          },
        });
      }

      // Delete related caisse transactions
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
    });

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
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

    // Create call record and update order in transaction
    const [call, updatedOrder] = await prisma.$transaction([
      prisma.orderCall.create({
        data: {
          orderId,
          result,
          notes: notes?.trim() || null,
        },
      }),
      prisma.order.update({
        where: { id: orderId },
        data: {
          confirmationStatus,
          callAttempts: { increment: 1 },
          // Auto-confirm order status if client picked up and confirmed
          ...(result === 'picked_up' && order.status === 'pending'
            ? { status: 'confirmed' }
            : {}),
          // Auto-cancel if rejected
          ...(result === 'rejected' ? { status: 'cancelled' } : {}),
        },
        include: {
          items: true,
          calls: { orderBy: { calledAt: 'desc' } },
        },
      }),
    ]);

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

    const [totalOrders, totalRevenue, byStatus, topProducts] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.aggregate({
        where,
        _sum: { total: true },
      }),
      prisma.order.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      prisma.orderItem.groupBy({
        by: ['productId', 'productName'],
        where: { order: where },
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const s of byStatus) {
      statusMap[s.status] = s._count._all;
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
        averageOrderValue: totalOrders > 0 ? Number(totalRevenue._sum.total || 0) / totalOrders : 0,
      },
      topProducts,
    });
  } catch (error) {
    console.error('Get order stats error:', error);
    res.status(500).json({ error: 'Failed to fetch order stats' });
  }
};
