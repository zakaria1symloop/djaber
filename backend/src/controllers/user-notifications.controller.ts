import { Request, Response } from 'express';
import prisma from '../config/database';

// GET /api/user-stock/notifications
export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const type = req.query.type as string | undefined;
    const isRead = req.query.isRead as string | undefined;

    const where: any = { userId };
    if (type) where.type = type;
    if (isRead === 'true') where.isRead = true;
    if (isRead === 'false') where.isRead = false;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    res.json({ notifications, total, page, limit });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// GET /api/user-stock/notifications/unread-count
export const getUnreadCount = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });
    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
};

// PUT /api/user-stock/notifications/read-all
export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    res.json({ count: result.count });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
};

// PUT /api/user-stock/notifications/:id/read
export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const notification = await prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });

    if (notification.count === 0) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    const updated = await prisma.notification.findUnique({ where: { id } });
    res.json({ notification: updated });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};
