import prisma from '../config/database';

interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

export async function createNotification({
  userId,
  type,
  title,
  message,
  metadata,
}: CreateNotificationParams) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        metadata: metadata ?? undefined,
      },
    });
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    // Don't throw — notifications are non-critical
    return null;
  }
}
