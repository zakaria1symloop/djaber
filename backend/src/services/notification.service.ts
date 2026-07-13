import prisma from '../config/database';
import { sendPushToUser } from './push.service';

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

    // Mirror every in-app notification as a mobile push (fire-and-forget).
    // Covers agent insights (HANDOFF/UNKNOWN/UNCLEAR) and any future callers.
    sendPushToUser(userId, {
      title,
      body: message,
      data: { type, ...(metadata ?? {}) },
    }).catch(() => {});

    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    // Don't throw — notifications are non-critical
    return null;
  }
}
