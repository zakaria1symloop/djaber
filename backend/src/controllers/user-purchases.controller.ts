import { Request, Response } from 'express';
import prisma from '../config/database';

// Generate purchase number inside a transaction client to avoid race conditions
const generatePurchaseNumber = async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], userId: string): Promise<string> => {
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
      supplierId,
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
    if (supplierId) where.supplierId = supplierId as string;

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

    const {
      supplierId,
      items,
      tax = 0,
      shippingCost = 0,
      paymentStatus = 'pending',
      status = 'pending',
      expectedDate,
      notes,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'At least one item is required' });
      return;
    }

    // Verify all products exist
    const productIds = items.map((item: any) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, userId: req.user.userId },
    });

    if (products.length !== productIds.length) {
      res.status(400).json({ error: 'One or more products not found' });
      return;
    }

    // Calculate totals
    let subtotal = 0;
    const purchaseItems = items.map((item: any) => {
      const product = products.find((p) => p.id === item.productId)!;
      const unitCost = item.unitCost || Number(product.costPrice);
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

    // Create purchase with number generation inside transaction to prevent race condition
    const MAX_RETRIES = 3;
    let purchase;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        purchase = await prisma.$transaction(async (tx) => {
          const purchaseNumber = await generatePurchaseNumber(tx, req.user!.userId);

          return tx.purchase.create({
            data: {
              userId: req.user!.userId,
              purchaseNumber,
              supplierId: supplierId || null,
              subtotal,
              tax,
              shippingCost,
              total,
              paymentStatus,
              status,
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
    const { paymentStatus, status, expectedDate, notes } = req.body;

    const existing = await prisma.purchase.findFirst({
      where: { id: purchaseId, userId: req.user.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Purchase not found' });
      return;
    }

    const purchase = await prisma.purchase.update({
      where: { id: purchaseId },
      data: {
        ...(paymentStatus && { paymentStatus }),
        ...(status && { status }),
        ...(expectedDate !== undefined && {
          expectedDate: expectedDate ? new Date(expectedDate) : null,
        }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
      },
      include: { supplier: true, items: true },
    });

    res.json({ purchase });
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

    // Delete purchase (cascades to items via schema)
    await prisma.purchase.delete({ where: { id: purchaseId } });

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
    const { items } = req.body; // Array of { itemId, receivedQty }

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Items to receive are required' });
      return;
    }

    const purchase = await prisma.purchase.findFirst({
      where: { id: purchaseId, userId: req.user.userId },
      include: { items: true },
    });

    if (!purchase) {
      res.status(404).json({ error: 'Purchase not found' });
      return;
    }

    // Process receiving in transaction
    const updatedPurchase = await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const purchaseItem = purchase.items.find((pi) => pi.id === item.itemId);
        if (!purchaseItem) continue;

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
            userId: req.user!.userId,
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
      userId: req.user.userId,
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
    console.error('Get purchase stats error:', error);
    res.status(500).json({ error: 'Failed to fetch purchase stats' });
  }
};
