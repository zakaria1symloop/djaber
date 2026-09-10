import { Request, Response } from 'express';
import prisma from '../config/database';
import { fail, handleError } from '../errors';
import { Validator, pagination } from '../middleware/validate';

// GET /api/user-stock/notifications
export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const userId = req.user.userId;

    const v = new Validator();
    const { page, limit, offset } = pagination(req.query, { limit: 20, maxLimit: 100 });
    const type = v.optionalString(req.query.type, 'type', { max: 50 });
    const isRead = req.query.isRead === undefined || req.query.isRead === '' ? undefined : v.boolean(req.query.isRead, 'isRead');
    v.throwIfAny();

    const where: Record<string, unknown> = { userId };
    if (type) where.type = type;
    if (isRead !== undefined) where.isRead = isRead;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    res.json({ notifications, total, page, limit });
  } catch (error) {
    handleError(req, res, error, 'NOTIF_LIST_FAILED');
  }
};

// GET /api/user-stock/notifications/unread-count
export const getUnreadCount = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const count = await prisma.notification.count({
      where: { userId: req.user.userId, isRead: false },
    });
    res.json({ count });
  } catch (error) {
    handleError(req, res, error, 'NOTIF_COUNT_FAILED');
  }
};

// PUT /api/user-stock/notifications/read-all
export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const result = await prisma.notification.updateMany({
      where: { userId: req.user.userId, isRead: false },
      data: { isRead: true },
    });
    res.json({ count: result.count });
  } catch (error) {
    handleError(req, res, error, 'NOTIF_MARK_READ_FAILED');
  }
};

// PUT /api/user-stock/notifications/:id/read
export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    const userId = req.user.userId;
    const id = String(req.params.id);

    const notification = await prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });

    if (notification.count === 0) return fail(req, res, 'NOTIFICATION_NOT_FOUND');

    const updated = await prisma.notification.findUnique({ where: { id } });
    res.json({ notification: updated });
  } catch (error) {
    handleError(req, res, error, 'NOTIF_MARK_READ_FAILED');
  }
};
