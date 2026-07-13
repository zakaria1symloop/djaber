import { Request, Response } from 'express';
import prisma from '../config/database';

// Expo push tokens look like ExponentPushToken[xxxxxxxx] — reject junk strings
const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[[^\]]+\]$/;
// Bound DeviceToken rows per user (abuse guard + push fan-out cap)
const MAX_DEVICES_PER_USER = 20;

/**
 * Register (or refresh) a device's Expo push token for the logged-in user.
 * Upsert by token: if another user logs in on the same phone, the token moves to them.
 */
export const registerDevice = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
      return;
    }

    const { token, platform } = req.body as { token?: string; platform?: string };
    if (!token || typeof token !== 'string' || !EXPO_TOKEN_RE.test(token)) {
      res.status(400).json({ error: 'Bad Request', message: 'A valid Expo push token is required' });
      return;
    }

    const device = await prisma.deviceToken.upsert({
      where: { token },
      update: { userId: req.user.userId, platform: platform || 'android' },
      create: { token, userId: req.user.userId, platform: platform || 'android' },
    });

    // Enforce per-user cap: keep the most recent MAX, drop the rest
    const extras = await prisma.deviceToken.findMany({
      where: { userId: req.user.userId },
      orderBy: { updatedAt: 'desc' },
      skip: MAX_DEVICES_PER_USER,
      select: { id: true },
    });
    if (extras.length > 0) {
      await prisma.deviceToken.deleteMany({ where: { id: { in: extras.map((e) => e.id) } } });
    }

    res.json({ success: true, deviceId: device.id });
  } catch (error) {
    console.error('Register device error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to register device' });
  }
};

/**
 * Unregister a device token (called on logout so the phone stops receiving pushes).
 */
export const unregisterDevice = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
      return;
    }

    const { token } = req.body as { token?: string };
    if (!token) {
      res.status(400).json({ error: 'Bad Request', message: 'token is required' });
      return;
    }

    await prisma.deviceToken.deleteMany({
      where: { token, userId: req.user.userId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Unregister device error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to unregister device' });
  }
};
