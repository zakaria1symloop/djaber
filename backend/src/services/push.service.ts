import axios from 'axios';
import prisma from '../config/database';

/**
 * Push notifications via Expo's push service.
 * No Firebase/APNs setup needed — Expo handles FCM/APNs delivery.
 * Docs: https://docs.expo.dev/push-notifications/sending-notifications/
 */
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface PushPayload {
  title: string;
  body: string;
  /** Arbitrary data delivered to the app (e.g. { conversationId }) for tap navigation */
  data?: Record<string, unknown>;
}

/**
 * Send a push notification to every registered device of a user.
 * Non-fatal by design: failures are logged, never thrown.
 * Cleans up tokens that Expo reports as DeviceNotRegistered.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    const devices = await prisma.deviceToken.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 20, // defense-in-depth fan-out cap (mirrors MAX_DEVICES_PER_USER)
    });
    if (devices.length === 0) return;

    const messages = devices.map((d) => ({
      to: d.token,
      sound: 'default' as const,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      priority: 'high' as const,
    }));

    // Expo accepts up to 100 messages per request
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      try {
        const res = await axios.post(EXPO_PUSH_URL, chunk, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        });

        // Remove tokens for uninstalled/expired devices
        const tickets: Array<{ status: string; details?: { error?: string } }> =
          res.data?.data || [];
        for (let j = 0; j < tickets.length; j++) {
          const ticket = tickets[j];
          if (ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
            await prisma.deviceToken
              .delete({ where: { token: chunk[j].to } })
              .catch(() => {});
          }
        }
      } catch (chunkErr: any) {
        console.warn('Expo push send failed:', chunkErr.response?.data || chunkErr.message);
      }
    }
  } catch (error: any) {
    console.warn('sendPushToUser error (non-fatal):', error.message);
  }
}
