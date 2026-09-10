import { Request, Response } from 'express';
import prisma from '../config/database';
import { fail, handleError } from '../errors';
import { Validator } from '../middleware/validate';

// Expo push tokens look like ExponentPushToken[xxxxxxxx] — reject junk strings
const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[[^\]]+\]$/;
// Bound DeviceToken rows per user (abuse guard + push fan-out cap)
const MAX_DEVICES_PER_USER = 20;
const PLATFORMS = ['android', 'ios'] as const;

/** Non-empty string token (≤ 255 chars); empty → DEVICE_TOKEN_REQUIRED. */
function readToken(value: unknown, v: Validator): string {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) {
    v.add('token', 'DEVICE_TOKEN_REQUIRED');
    return '';
  }
  if (s.length > 255) v.add('token', 'FIELD_TOO_LONG', { max: 255 });
  return s;
}

/**
 * Register (or refresh) a device's Expo push token for the logged-in user.
 * Upsert by token: if another user logs in on the same phone, the token moves to them.
 */
export const registerDevice = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const v = new Validator();
    const token = readToken(req.body?.token, v);
    if (token && !EXPO_TOKEN_RE.test(token)) v.add('token', 'DEVICE_TOKEN_INVALID');
    const platform = v.oneOf(req.body?.platform, 'platform', PLATFORMS, 'android');
    v.throwIfAny();

    const device = await prisma.deviceToken.upsert({
      where: { token },
      update: { userId: req.user.userId, platform },
      create: { token, userId: req.user.userId, platform },
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
    handleError(req, res, error, 'DEVICE_REGISTER_FAILED');
  }
};

/**
 * Unregister a device token (called on logout so the phone stops receiving pushes).
 */
export const unregisterDevice = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const v = new Validator();
    const token = readToken(req.body?.token, v);
    v.throwIfAny();

    await prisma.deviceToken.deleteMany({
      where: { token, userId: req.user.userId },
    });

    res.json({ success: true });
  } catch (error) {
    handleError(req, res, error, 'DEVICE_UNREGISTER_FAILED');
  }
};
