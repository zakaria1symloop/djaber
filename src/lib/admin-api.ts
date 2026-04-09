/**
 * Admin API client — calls /api/admin/* endpoints.
 * All endpoints require an admin user (isAdmin = true).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6001';

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export interface AdminAnalytics {
  period: string;
  stats: {
    totalUsers: number;
    newUsersInPeriod: number;
    adminCount: number;
    totalPages: number;
    totalProducts: number;
    totalSales: number;
    totalRevenue: number;
    totalPurchases: number;
    totalSpent: number;
    activeAgents: number;
    totalConversations: number;
    messagesInPeriod: number;
  };
  pagesByPlatform: Array<{ platform: string; count: number }>;
  planBreakdown: Array<{ plan: string; count: number }>;
  recentSignups: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    plan: string;
    createdAt: string;
  }>;
}

export async function getAdminAnalytics(
  period: 'today' | 'week' | 'month' | 'year' = 'month'
): Promise<AdminAnalytics> {
  return apiRequest<AdminAnalytics>(`/api/admin/analytics?period=${period}`);
}
