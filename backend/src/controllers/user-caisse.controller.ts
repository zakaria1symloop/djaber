import { Request, Response } from 'express';
import prisma from '../config/database';

const VALID_TYPES = ['income', 'expense'];
const VALID_CATEGORIES = ['sale', 'order', 'purchase', 'rent', 'salary', 'utilities', 'marketing', 'shipping', 'other'];

// ============================================================================
// List Caisse Transactions
// ============================================================================

export const getCaisseTransactions = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      type, category, dateFrom, dateTo, search,
      limit = '50', offset = '0',
    } = req.query;

    const where: any = { userId: req.user.userId };

    if (type && VALID_TYPES.includes(type as string)) {
      where.type = type as string;
    }
    if (category) {
      where.category = category as string;
    }
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom as string);
      if (dateTo) where.date.lte = new Date(dateTo as string);
    }
    if (search) {
      const s = search as string;
      where.OR = [
        { reference: { contains: s } },
        { description: { contains: s } },
      ];
    }

    const [transactions, total] = await Promise.all([
      prisma.caisseTransaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: parseInt(offset as string, 10),
        take: parseInt(limit as string, 10),
      }),
      prisma.caisseTransaction.count({ where }),
    ]);

    res.json({ transactions, total });
  } catch (error) {
    console.error('Get caisse transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

// ============================================================================
// Caisse Stats
// ============================================================================

export const getCaisseStats = async (req: Request, res: Response): Promise<void> => {
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
      date: { gte: startDate },
    };

    const [incomeAgg, expenseAgg, count] = await Promise.all([
      prisma.caisseTransaction.aggregate({
        where: { ...where, type: 'income' },
        _sum: { amount: true },
      }),
      prisma.caisseTransaction.aggregate({
        where: { ...where, type: 'expense' },
        _sum: { amount: true },
      }),
      prisma.caisseTransaction.count({ where }),
    ]);

    const totalIncome = Number(incomeAgg._sum.amount || 0);
    const totalExpense = Number(expenseAgg._sum.amount || 0);

    res.json({
      stats: {
        balance: totalIncome - totalExpense,
        totalIncome,
        totalExpense,
        transactionCount: count,
      },
    });
  } catch (error) {
    console.error('Get caisse stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

// ============================================================================
// Create Manual Transaction
// ============================================================================

export const createCaisseTransaction = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { type, amount, category, reference, description, date } = req.body;

    if (!type || !VALID_TYPES.includes(type)) {
      res.status(400).json({ error: 'Type must be income or expense' });
      return;
    }
    if (!amount || Number(amount) <= 0) {
      res.status(400).json({ error: 'Amount must be a positive number' });
      return;
    }
    if (!category || !VALID_CATEGORIES.includes(category)) {
      res.status(400).json({ error: `Category must be one of: ${VALID_CATEGORIES.join(', ')}` });
      return;
    }

    const transaction = await prisma.caisseTransaction.create({
      data: {
        userId: req.user.userId,
        type,
        amount: Number(amount),
        category,
        reference: reference?.trim() || null,
        description: description?.trim() || null,
        date: date ? new Date(date) : new Date(),
        isAutomatic: false,
      },
    });

    res.status(201).json({ transaction });
  } catch (error) {
    console.error('Create caisse transaction error:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
};

// ============================================================================
// Update Manual Transaction
// ============================================================================

export const updateCaisseTransaction = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const id = req.params.id as string;
    const { type, amount, category, reference, description, date } = req.body;

    const existing = await prisma.caisseTransaction.findFirst({
      where: { id, userId: req.user.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }
    if (existing.isAutomatic) {
      res.status(400).json({ error: 'Cannot edit automatic transactions' });
      return;
    }

    const transaction = await prisma.caisseTransaction.update({
      where: { id },
      data: {
        ...(type && VALID_TYPES.includes(type) && { type }),
        ...(amount !== undefined && { amount: Number(amount) }),
        ...(category && VALID_CATEGORIES.includes(category) && { category }),
        ...(reference !== undefined && { reference: reference?.trim() || null }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(date !== undefined && { date: new Date(date) }),
      },
    });

    res.json({ transaction });
  } catch (error) {
    console.error('Update caisse transaction error:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
};

// ============================================================================
// Delete Manual Transaction
// ============================================================================

export const deleteCaisseTransaction = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const id = req.params.id as string;

    const existing = await prisma.caisseTransaction.findFirst({
      where: { id, userId: req.user.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }
    if (existing.isAutomatic) {
      res.status(400).json({ error: 'Cannot delete automatic transactions' });
      return;
    }

    await prisma.caisseTransaction.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete caisse transaction error:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
};
