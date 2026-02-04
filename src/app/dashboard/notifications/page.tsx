'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  BellIcon,
  BotIcon,
  AlertIcon,
  CheckCircleIcon,
} from '@/components/ui/icons';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type Notification,
} from '@/lib/notifications-api';

// Extensible notification type config
const NOTIFICATION_TYPES: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  label: string;
}> = {
  ai_order: { icon: BotIcon, color: 'text-blue-400 bg-blue-500/10', label: 'AI Order' },
  stock_alert: { icon: AlertIcon, color: 'text-amber-400 bg-amber-500/10', label: 'Stock Alert' },
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [readFilter, setReadFilter] = useState('');
  const limit = 20;

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getNotifications({
        page,
        limit,
        type: typeFilter || undefined,
        isRead: readFilter || undefined,
      });
      setNotifications(data.notifications);
      setTotal(data.total);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, readFilter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (notification: Notification) => {
    if (!notification.isRead) {
      try {
        await markNotificationAsRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
        );
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
    }
    // Navigate based on type
    if (notification.type === 'ai_order') {
      router.push('/dashboard/stock/orders');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // Stats
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const aiOrderCount = notifications.filter((n) => n.type === 'ai_order').length;
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const thisWeekCount = notifications.filter((n) => new Date(n.createdAt) >= weekAgo).length;

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          <p className="text-sm text-zinc-400 mt-1">Stay updated with your AI agent activity</p>
        </div>
        <button
          onClick={handleMarkAllAsRead}
          className="px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors"
        >
          Mark All as Read
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: total, color: 'text-white' },
          { label: 'Unread', value: unreadCount, color: 'text-blue-400' },
          { label: 'AI Orders', value: aiOrderCount, color: 'text-emerald-400' },
          { label: 'This Week', value: thisWeekCount, color: 'text-purple-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-zinc-500"
        >
          <option value="">All Types</option>
          <option value="ai_order">AI Order</option>
          <option value="stock_alert">Stock Alert</option>
        </select>
        <select
          value={readFilter}
          onChange={(e) => { setReadFilter(e.target.value); setPage(1); }}
          className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-zinc-500"
        >
          <option value="">All</option>
          <option value="false">Unread</option>
          <option value="true">Read</option>
        </select>
      </div>

      {/* Notification List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-zinc-800 rounded w-1/3" />
                  <div className="h-3 bg-zinc-800 rounded w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
            <BellIcon className="w-8 h-8 text-zinc-600" />
          </div>
          <h3 className="text-lg font-medium text-white mb-1">No notifications yet</h3>
          <p className="text-sm text-zinc-500 max-w-sm">
            Notifications will appear here when your AI agents create orders or other important events occur.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const typeConfig = NOTIFICATION_TYPES[notification.type] || {
              icon: BellIcon,
              color: 'text-zinc-400 bg-zinc-500/10',
              label: notification.type,
            };
            const TypeIcon = typeConfig.icon;

            return (
              <button
                key={notification.id}
                onClick={() => handleMarkAsRead(notification)}
                className={`w-full text-left rounded-xl p-4 transition-all hover:bg-zinc-800/80 ${
                  notification.isRead
                    ? 'bg-zinc-900/30 border border-zinc-800/50'
                    : 'bg-zinc-900 border border-zinc-800 border-l-2 border-l-blue-500'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${typeConfig.color}`}>
                    <TypeIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={`text-sm font-medium truncate ${
                        notification.isRead ? 'text-zinc-400' : 'text-white'
                      }`}>
                        {notification.title}
                      </h3>
                      <span className="text-xs text-zinc-600 shrink-0">
                        {timeAgo(notification.createdAt)}
                      </span>
                    </div>
                    <p className={`text-sm mt-0.5 ${
                      notification.isRead ? 'text-zinc-600' : 'text-zinc-400'
                    }`}>
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${typeConfig.color}`}>
                        {typeConfig.label}
                      </span>
                      {notification.isRead && (
                        <span className="inline-flex items-center gap-1 text-xs text-zinc-600">
                          <CheckCircleIcon className="w-3 h-3" />
                          Read
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-zinc-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
