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

// ============================================================================
// AI Providers
// ============================================================================

export interface AdminAIProvider {
  id: string;
  provider: string;
  displayName: string;
  apiKey: string; // masked from server: '...last8'
  isActive: boolean;
  models: string[];
  createdAt: string;
  updatedAt: string;
}

export async function getAdminAIProviders(): Promise<{ providers: AdminAIProvider[] }> {
  return apiRequest<{ providers: AdminAIProvider[] }>('/api/admin/ai-providers');
}

export async function updateAdminAIProvider(
  provider: string,
  data: { apiKey?: string; isActive?: boolean; models?: string[] }
): Promise<{ provider: AdminAIProvider }> {
  return apiRequest<{ provider: AdminAIProvider }>(`/api/admin/ai-providers/${provider}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ============================================================================
// Users
// ============================================================================

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  plan: string;
  isAdmin: boolean;
  createdAt: string;
  _counts: {
    pages: number;
    agents: number;
    conversations: number;
    products: number;
    sales: number;
    orders: number;
    clients: number;
  };
  _revenue: number;
}

export interface AdminUserDetails {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    plan: string;
    isAdmin: boolean;
    createdAt: string;
    updatedAt: string;
  };
  pages: Array<{
    id: string;
    pageName: string;
    platform: string;
    isActive: boolean;
    createdAt: string;
    _count: { conversations: number };
  }>;
  agents: Array<{
    id: string;
    name: string;
    personality: string;
    aiModel: string;
    isActive: boolean;
    createdAt: string;
    _count: { pages: number; products: number; conversations: number };
  }>;
  stats: {
    products: number;
    sales: number;
    revenue: number;
    purchases: number;
    spent: number;
    orders: number;
    clients: number;
    conversations: number;
    messages: number;
  };
  recentConversations: Array<{
    id: string;
    senderName: string | null;
    platform: string;
    status: string;
    updatedAt: string;
    page: { pageName: string } | null;
    _count: { messages: number };
  }>;
}

export async function listAdminUsers(params?: {
  search?: string;
  plan?: string;
  role?: 'admin' | 'user';
  startDate?: string;
  endDate?: string;
  sortBy?: 'createdAt' | 'email' | 'firstName' | 'lastName' | 'plan';
  sortOrder?: 'asc' | 'desc';
  minPages?: number;
  maxPages?: number;
  minProducts?: number;
  maxProducts?: number;
  minRevenue?: number;
  maxRevenue?: number;
  minConversations?: number;
  activity?: 'with-pages' | 'with-agents' | 'inactive';
  limit?: number;
  offset?: number;
}): Promise<{ users: AdminUser[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.plan) query.set('plan', params.plan);
  if (params?.role) query.set('role', params.role);
  if (params?.startDate) query.set('startDate', params.startDate);
  if (params?.endDate) query.set('endDate', params.endDate);
  if (params?.sortBy) query.set('sortBy', params.sortBy);
  if (params?.sortOrder) query.set('sortOrder', params.sortOrder);
  if (params?.minPages !== undefined) query.set('minPages', params.minPages.toString());
  if (params?.maxPages !== undefined) query.set('maxPages', params.maxPages.toString());
  if (params?.minProducts !== undefined) query.set('minProducts', params.minProducts.toString());
  if (params?.maxProducts !== undefined) query.set('maxProducts', params.maxProducts.toString());
  if (params?.minRevenue !== undefined) query.set('minRevenue', params.minRevenue.toString());
  if (params?.maxRevenue !== undefined) query.set('maxRevenue', params.maxRevenue.toString());
  if (params?.minConversations !== undefined) query.set('minConversations', params.minConversations.toString());
  if (params?.activity) query.set('activity', params.activity);
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.offset) query.set('offset', params.offset.toString());
  const qs = query.toString();
  return apiRequest<{ users: AdminUser[]; total: number }>(`/api/admin/users${qs ? `?${qs}` : ''}`);
}

export async function getAdminUserDetails(userId: string): Promise<AdminUserDetails> {
  return apiRequest<AdminUserDetails>(`/api/admin/users/${userId}`);
}

export async function updateAdminUser(
  userId: string,
  data: { isAdmin?: boolean; plan?: string; firstName?: string; lastName?: string; password?: string }
): Promise<{ user: Omit<AdminUser, '_count'> }> {
  return apiRequest(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteAdminUser(userId: string): Promise<{ success: boolean }> {
  return apiRequest(`/api/admin/users/${userId}`, { method: 'DELETE' });
}

// ============================================================================
// Plans
// ============================================================================

export interface AdminPlan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceMonthly: number | string;
  priceYearly: number | string;
  currency: string;
  maxPages: number;
  maxAgents: number;
  maxProducts: number;
  maxConversations: number;
  maxTeamMembers: number;
  features: string[];
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  chargilyProductId: string | null;
  chargilyPriceMonthlyId: string | null;
  chargilyPriceYearlyId: string | null;
  subscriberCount: number;
  createdAt: string;
  updatedAt: string;
}

export async function listAdminPlans(): Promise<{ plans: AdminPlan[] }> {
  return apiRequest<{ plans: AdminPlan[] }>('/api/admin/plans');
}

export type AdminPlanInput = {
  slug: string;
  name: string;
  description?: string | null;
  priceMonthly?: number;
  priceYearly?: number;
  currency?: string;
  maxPages?: number;
  maxAgents?: number;
  maxProducts?: number;
  maxConversations?: number;
  maxTeamMembers?: number;
  features?: string[];
  isActive?: boolean;
  isFeatured?: boolean;
  sortOrder?: number;
  chargilyProductId?: string | null;
  chargilyPriceMonthlyId?: string | null;
  chargilyPriceYearlyId?: string | null;
};

export async function createAdminPlan(data: AdminPlanInput): Promise<{ plan: AdminPlan }> {
  return apiRequest<{ plan: AdminPlan }>('/api/admin/plans', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAdminPlan(planId: string, data: Partial<AdminPlanInput>): Promise<{ plan: AdminPlan }> {
  return apiRequest<{ plan: AdminPlan }>(`/api/admin/plans/${planId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteAdminPlan(planId: string): Promise<{ success: boolean }> {
  return apiRequest(`/api/admin/plans/${planId}`, { method: 'DELETE' });
}

// ============================================================================
// Subscriptions
// ============================================================================

export interface AdminSubscription {
  id: string;
  userId: string;
  planSlug: string;
  status: string;
  billingCycle: string;
  startDate: string;
  endDate: string;
  cancelledAt: string | null;
  chargilySubscriptionId: string | null;
  chargilyCustomerId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; email: string; firstName: string; lastName: string } | null;
  plan: {
    id: string;
    slug: string;
    name: string;
    priceMonthly: number | string;
    priceYearly: number | string;
    currency: string;
  } | null;
}

export interface AdminSubscriptionInput {
  userId: string;
  planSlug: string;
  billingCycle?: 'monthly' | 'yearly';
  startDate?: string;
  endDate?: string;
  status?: 'active' | 'cancelled' | 'expired' | 'trial';
  notes?: string | null;
  chargilySubscriptionId?: string | null;
  chargilyCustomerId?: string | null;
}

export async function listAdminSubscriptions(params?: {
  status?: string;
  planSlug?: string;
  search?: string;
  expiringBefore?: string;
  limit?: number;
  offset?: number;
}): Promise<{ subscriptions: AdminSubscription[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.planSlug) query.set('planSlug', params.planSlug);
  if (params?.search) query.set('search', params.search);
  if (params?.expiringBefore) query.set('expiringBefore', params.expiringBefore);
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.offset) query.set('offset', params.offset.toString());
  const qs = query.toString();
  return apiRequest(`/api/admin/subscriptions${qs ? `?${qs}` : ''}`);
}

export async function createAdminSubscription(data: AdminSubscriptionInput): Promise<{ subscription: AdminSubscription }> {
  return apiRequest('/api/admin/subscriptions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAdminSubscription(subId: string, data: Partial<AdminSubscriptionInput>): Promise<{ subscription: AdminSubscription }> {
  return apiRequest(`/api/admin/subscriptions/${subId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteAdminSubscription(subId: string): Promise<{ success: boolean }> {
  return apiRequest(`/api/admin/subscriptions/${subId}`, { method: 'DELETE' });
}

// ============================================================================
// Conversations
// ============================================================================

export interface AdminConversation {
  id: string;
  senderName: string | null;
  senderId: string;
  platform: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  page: { id: string; pageName: string; platform: string } | null;
  user: { id: string; email: string; firstName: string; lastName: string } | null;
  agent: { id: string; name: string } | null;
  _count: { messages: number };
}

export interface AdminConversationDetails extends AdminConversation {
  messages: Array<{
    id: string;
    text: string | null;
    isFromPage: boolean;
    timestamp: string;
    senderId: string;
    attachmentType?: string | null;
    attachmentUrl?: string | null;
    createdAt: string;
  }>;
}

export async function listAdminConversations(params?: {
  search?: string;
  platform?: string;
  status?: string;
  userId?: string;
  pageId?: string;
  agentId?: string;
  minMessages?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<{ conversations: AdminConversation[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.platform) query.set('platform', params.platform);
  if (params?.status) query.set('status', params.status);
  if (params?.userId) query.set('userId', params.userId);
  if (params?.pageId) query.set('pageId', params.pageId);
  if (params?.agentId) query.set('agentId', params.agentId);
  if (params?.minMessages !== undefined) query.set('minMessages', params.minMessages.toString());
  if (params?.startDate) query.set('startDate', params.startDate);
  if (params?.endDate) query.set('endDate', params.endDate);
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.offset) query.set('offset', params.offset.toString());
  const qs = query.toString();
  return apiRequest(`/api/admin/conversations${qs ? `?${qs}` : ''}`);
}

export async function getAdminConversationDetails(
  id: string
): Promise<{ conversation: AdminConversationDetails }> {
  return apiRequest(`/api/admin/conversations/${id}`);
}

// ============================================================================
// Products (cross-user)
// ============================================================================

export interface AdminProduct {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  imageUrl: string | null;
  costPrice: number | string;
  sellingPrice: number | string;
  quantity: number;
  minQuantity: number;
  isActive: boolean;
  createdAt: string;
  userId: string | null;
  category: { id: string; name: string } | null;
  isLowStock: boolean;
  owner: { id: string; email: string; firstName: string; lastName: string } | null;
}

export async function listAdminProducts(params?: {
  search?: string;
  lowStock?: boolean;
  userId?: string;
  categoryId?: string;
  isActive?: boolean;
  minPrice?: number;
  maxPrice?: number;
  minStock?: number;
  maxStock?: number;
  hasImage?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ products: AdminProduct[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.lowStock) query.set('lowStock', 'true');
  if (params?.userId) query.set('userId', params.userId);
  if (params?.categoryId) query.set('categoryId', params.categoryId);
  if (params?.isActive !== undefined) query.set('isActive', params.isActive.toString());
  if (params?.minPrice !== undefined) query.set('minPrice', params.minPrice.toString());
  if (params?.maxPrice !== undefined) query.set('maxPrice', params.maxPrice.toString());
  if (params?.minStock !== undefined) query.set('minStock', params.minStock.toString());
  if (params?.maxStock !== undefined) query.set('maxStock', params.maxStock.toString());
  if (params?.hasImage !== undefined) query.set('hasImage', params.hasImage.toString());
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.offset) query.set('offset', params.offset.toString());
  const qs = query.toString();
  return apiRequest(`/api/admin/products${qs ? `?${qs}` : ''}`);
}

// ============================================================================
// Lookups (for filter dropdowns)
// ============================================================================

export interface AdminLookupCategory { id: string; name: string; userId: string | null; }
export interface AdminLookupPage { id: string; pageName: string; platform: string; userId: string; }
export interface AdminLookupAgent { id: string; name: string; userId: string; }

export async function listAdminLookupCategories(): Promise<{ categories: AdminLookupCategory[] }> {
  return apiRequest('/api/admin/lookups/categories');
}
export async function listAdminLookupPages(): Promise<{ pages: AdminLookupPage[] }> {
  return apiRequest('/api/admin/lookups/pages');
}
export async function listAdminLookupAgents(): Promise<{ agents: AdminLookupAgent[] }> {
  return apiRequest('/api/admin/lookups/agents');
}

// ============================================================================
// Admin profile
// ============================================================================

// ============================================================================
// CMS Pages
// ============================================================================

export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  category: 'company' | 'legal';
  content: string;
  isPublished: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export async function listCmsPages(category?: string): Promise<{ pages: CmsPage[] }> {
  const qs = category ? `?category=${category}` : '';
  return apiRequest<{ pages: CmsPage[] }>(`/api/admin/cms${qs}`);
}

export async function getCmsPage(slug: string): Promise<{ page: CmsPage }> {
  return apiRequest<{ page: CmsPage }>(`/api/admin/cms/${slug}`);
}

export async function upsertCmsPage(data: {
  slug: string;
  title: string;
  category: string;
  content: string;
  isPublished?: boolean;
  sortOrder?: number;
}): Promise<{ page: CmsPage }> {
  return apiRequest<{ page: CmsPage }>('/api/admin/cms', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteCmsPage(slug: string): Promise<{ success: boolean }> {
  return apiRequest(`/api/admin/cms/${slug}`, { method: 'DELETE' });
}

// ============================================================================
// Admin profile
// ============================================================================

export async function updateAdminProfile(data: {
  firstName?: string;
  lastName?: string;
  password?: string;
  currentPassword?: string;
}): Promise<{ user: { id: string; email: string; firstName: string; lastName: string; isAdmin: boolean } }> {
  return apiRequest('/api/admin/profile', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
