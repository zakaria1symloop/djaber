import { apiRequest } from './api-config';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, any> | null;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

interface GetNotificationsParams {
  page?: number;
  limit?: number;
  type?: string;
  isRead?: string; // 'true' | 'false'
}

interface GetNotificationsResponse {
  notifications: Notification[];
  total: number;
  page: number;
  limit: number;
}

interface UnreadCountResponse {
  count: number;
}

interface MarkReadResponse {
  notification: Notification;
}

interface MarkAllReadResponse {
  count: number;
}

export async function getNotifications(params: GetNotificationsParams = {}): Promise<GetNotificationsResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.type) searchParams.set('type', params.type);
  if (params.isRead) searchParams.set('isRead', params.isRead);

  const query = searchParams.toString();
  return apiRequest<GetNotificationsResponse>(`/api/user-stock/notifications${query ? `?${query}` : ''}`);
}

export async function getUnreadCount(): Promise<UnreadCountResponse> {
  return apiRequest<UnreadCountResponse>('/api/user-stock/notifications/unread-count');
}

export async function markNotificationAsRead(id: string): Promise<MarkReadResponse> {
  return apiRequest<MarkReadResponse>(`/api/user-stock/notifications/${id}/read`, {
    method: 'PUT',
  });
}

export async function markAllNotificationsAsRead(): Promise<MarkAllReadResponse> {
  return apiRequest<MarkAllReadResponse>('/api/user-stock/notifications/read-all', {
    method: 'PUT',
  });
}
