// Wire types of the notification centre (api-contract §3.12, 06 §2; WS payloads of 03-events §2).
import type { NotificationType } from '@djaber/shared';

export type { NotificationType };
export type NotificationGroup =
  | 'orders'
  | 'queue'
  | 'ai'
  | 'stock'
  | 'parcels'
  | 'payments'
  | 'pages'
  | 'credits_plan'
  | 'members'
  | 'integrations'
  | 'jobs'
  | 'moderation'
  | 'safety'
  | 'support'
  | 'platform';

export type Notification = {
  id: string;
  type: NotificationType;
  group: NotificationGroup;
  title: string;
  body: string;
  deepLink: { web: string; mobile: string } | null;
  readAt: string | null;
  createdAt: string;
};
export type UnreadCount = { count: number };

export type WsNotificationCreated = { notification: Pick<Notification, 'id' | 'type' | 'title' | 'body' | 'createdAt'> & { data?: Record<string, unknown> }; unreadCount: number };
export type WsNotificationRead = { ids: string[] | 'all'; unreadCount: number };

/** `GET /data-deletion/:code` (public) — api-contract §3.14. */
export type DataDeletionStatus = { code: string; status: 'pending' | 'done' | 'not_found'; requestedAt: string | null; completedAt: string | null };
