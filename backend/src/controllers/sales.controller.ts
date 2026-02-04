import { Request, Response } from 'express';
import prisma from '../config/database';

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

// ============================================================================
// Sales
// ============================================================================

export const getSales = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const pageId = req.params.pageId as string;
    const {
      startDate,
      endDate,
      paymentStatus,
      limit = '50',
      offset = '0'
    } = req.query;

    const page = await prisma.page.findFirst({
      where: { id: pageId, userId: req.user.userId, isActive: true },
    });

    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }

    const where: any = { pageId };

    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) where.saleDate.gte = new Date(startDate as string);
      if (endDate) where.saleDate.lte = new Date(endDate as string);
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
        skip: parseInt(offset as string, 10),
        take: parseInt(limit as string, 10),
      }),
      prisma.sale.count({ where }),
    ]);

    res.json({ sales, total });
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
};

export const getSale = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const pageId = req.params.pageId as string;
    const saleId = req.params.saleId as string;

    const page = await prisma.page.findFirst({
      where: { id: pageId, userId: req.user.userId, isActive: true },
    });

    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }

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

    if (!sale) {
      res.status(404).json({ error: 'Sale not found' });
      return;
    }

    res.json({ sale });
  } catch (error) {
    console.error('Get sale error:', error);
    res.status(500).json({ error: 'Failed to fetch sale' });
  }
};

export const createSale = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const pageId = req.params.pageId as string;
    const {
      customerName,
      customerPhone,
      items,
      discount = 0,
      tax = 0,
      paymentMethod = 'cash',
      paymentStatus = 'paid',
      notes,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'At least one item is required' });
      return;
    }

    const page = await prisma.page.findFirst({
      where: { id: pageId, userId: req.user.userId, isActive: true },
    });

    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }

    // Verify all products exist and have enough stock
    const productIds = items.map((item: any) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, pageId, isActive: true },
    });

    if (products.length !== productIds.length) {
      res.status(400).json({ error: 'One or more products not found' });
      return;
    }

    // Check stock availability
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) continue;
      if (product.quantity < item.quantity) {
        res.status(400).json({
          error: `Insufficient stock for ${product.name}. Available: ${product.quantity}`,
        });
        return;
      }
    }

    // Calculate totals
    let subtotal = 0;
    const saleItems = items.map((item: any) => {
      const product = products.find((p) => p.id === item.productId)!;
      const unitPrice = item.unitPrice || Number(product.sellingPrice);
      const itemDiscount = item.discount || 0;
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
          customerName: customerName?.trim() || null,
          customerPhone: customerPhone?.trim() || null,
          subtotal,
          discount,
          tax,
          total,
          paymentMethod,
          paymentStatus,
          notes: notes?.trim() || null,
          items: {
            create: saleItems,
          },
        },
        include: { items: true },
      });

      // Update product quantities and create stock movements
      for (const item of items) {
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
    console.error('Create sale error:', error);
    res.status(500).json({ error: 'Failed to create sale' });
  }
};

export const updateSalePayment = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const pageId = req.params.pageId as string;
    const saleId = req.params.saleId as string;
    const { paymentStatus, paymentMethod, notes } = req.body;

    const page = await prisma.page.findFirst({
      where: { id: pageId, userId: req.user.userId, isActive: true },
    });

    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }

    const sale = await prisma.sale.update({
      where: { id: saleId },
      data: {
        ...(paymentStatus && { paymentStatus }),
        ...(paymentMethod && { paymentMethod }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
      },
      include: { items: true },
    });

    res.json({ sale });
  } catch (error) {
    console.error('Update sale error:', error);
    res.status(500).json({ error: 'Failed to update sale' });
  }
};

// ============================================================================
// Sales Stats
// ============================================================================

export const getSalesStats = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const pageId = req.params.pageId as string;
    const { period = 'today' } = req.query;

    const page = await prisma.page.findFirst({
      where: { id: pageId, userId: req.user.userId, isActive: true },
    });

    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }

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
    console.error('Get sales stats error:', error);
    res.status(500).json({ error: 'Failed to fetch sales stats' });
  }
};
