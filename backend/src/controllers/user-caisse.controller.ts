import { Request, Response } from 'express';
import prisma from '../config/database';
import { ApiError, fail, handleError } from '../errors';
import { Validator, pagination } from '../middleware/validate';

// Enumerations mirrored from the Prisma schema comments (model CaisseTransaction)
const CAISSE_TYPES = ['income', 'expense'] as const;
const CAISSE_CATEGORIES = ['sale', 'order', 'purchase', 'rent', 'salary', 'utilities', 'marketing', 'shipping', 'other'] as const;

// ============================================================================
// List Caisse Transactions
// ============================================================================

export const getCaisseTransactions = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const { search } = req.query;

    const v = new Validator();
    const type = v.oneOf(req.query.type, 'type', CAISSE_TYPES, CAISSE_TYPES[0]);
    const category = v.oneOf(req.query.category, 'category', CAISSE_CATEGORIES, CAISSE_CATEGORIES[0]);
    const dateFrom = v.date(req.query.dateFrom, 'dateFrom');
    const dateTo = v.date(req.query.dateTo, 'dateTo');
    v.throwIfAny();
    if (dateFrom && dateTo && dateFrom > dateTo) throw new ApiError('INVALID_DATE_RANGE');
    const { limit, offset } = pagination(req.query);

    const where: any = { userId: req.user.userId };

    if (req.query.type) where.type = type;
    if (req.query.category) where.category = category;
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = dateFrom;
      if (dateTo) {
        // Treat a bare date as the whole day (inclusive). Otherwise
        // `new Date('2026-05-12')` becomes midnight UTC and a transaction
        // logged at 10:00 AM that same day is excluded.
        if (!String(req.query.dateTo).includes('T')) {
          dateTo.setHours(23, 59, 59, 999);
        }
        where.date.lte = dateTo;
      }
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
        skip: offset,
        take: limit,
      }),
      prisma.caisseTransaction.count({ where }),
    ]);

    res.json({ transactions, total });
  } catch (error) {
    return handleError(req, res, error, 'CAISSE_FETCH_FAILED');
  }
};

// ============================================================================
// Caisse Stats
// ============================================================================

export const getCaisseStats = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

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
    return handleError(req, res, error, 'CAISSE_STATS_FAILED');
  }
};

// ============================================================================
// Create Manual Transaction
// ============================================================================

export const createCaisseTransaction = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const v = new Validator();
    const type = v.oneOf(req.body.type, 'type', CAISSE_TYPES);
    const amount = v.number(req.body.amount, 'amount', { positive: true });
    const category = v.oneOf(req.body.category, 'category', CAISSE_CATEGORIES);
    const reference = v.optionalString(req.body.reference, 'reference', { max: 191 });
    const description = v.optionalString(req.body.description, 'description');
    const date = v.date(req.body.date, 'date');
    v.throwIfAny();

    const transaction = await prisma.caisseTransaction.create({
      data: {
        userId: req.user.userId,
        type,
        amount,
        category,
        reference,
        description,
        date: date ?? new Date(),
        isAutomatic: false,
      },
    });

    res.status(201).json({ transaction });
  } catch (error) {
    return handleError(req, res, error, 'CAISSE_CREATE_FAILED');
  }
};

// ============================================================================
// Update Manual Transaction
// ============================================================================

export const updateCaisseTransaction = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const id = req.params.id as string;
    const body = req.body ?? {};

    const v = new Validator();
    const type = body.type === undefined ? undefined : v.oneOf(body.type, 'type', CAISSE_TYPES);
    const amount = body.amount === undefined ? undefined : v.number(body.amount, 'amount', { positive: true });
    const category = body.category === undefined ? undefined : v.oneOf(body.category, 'category', CAISSE_CATEGORIES);
    const reference = body.reference === undefined ? undefined : v.optionalString(body.reference, 'reference', { max: 191 });
    const description = body.description === undefined ? undefined : v.optionalString(body.description, 'description');
    const date = body.date === undefined ? undefined : v.date(body.date, 'date', { required: true });
    v.throwIfAny();

    const existing = await prisma.caisseTransaction.findFirst({
      where: { id, userId: req.user.userId },
    });

    if (!existing) return fail(req, res, 'TRANSACTION_NOT_FOUND');
    if (existing.isAutomatic) return fail(req, res, 'CAISSE_EDIT_AUTOMATIC');

    const transaction = await prisma.caisseTransaction.update({
      where: { id },
      data: {
        ...(type !== undefined && { type }),
        ...(amount !== undefined && { amount }),
        ...(category !== undefined && { category }),
        ...(reference !== undefined && { reference }),
        ...(description !== undefined && { description }),
        ...(date && { date }),
      },
    });

    res.json({ transaction });
  } catch (error) {
    return handleError(req, res, error, 'CAISSE_UPDATE_FAILED');
  }
};

// ============================================================================
// Delete Manual Transaction
// ============================================================================

export const deleteCaisseTransaction = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const id = req.params.id as string;

    const existing = await prisma.caisseTransaction.findFirst({
      where: { id, userId: req.user.userId },
    });

    if (!existing) return fail(req, res, 'TRANSACTION_NOT_FOUND');
    if (existing.isAutomatic) return fail(req, res, 'CAISSE_DELETE_AUTOMATIC');

    await prisma.caisseTransaction.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    return handleError(req, res, error, 'CAISSE_DELETE_FAILED');
  }
};
