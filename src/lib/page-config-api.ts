import { apiRequest } from './api-config';

// ==================== TYPE DEFINITIONS ====================

export interface PageInsight {
  name: string;
  period: string;
  values: Array<{ value: number; end_time: string }>;
  title: string;
  description: string;
  id: string;
}

export interface PageInsightsResponse {
  data: PageInsight[];
}

export interface ConversationSummary {
  id: string;
  senderId: string;
  senderName: string | null;
  status: string;
  lastMessage: {
    text: string | null;
    timestamp: string;
    isFromPage: boolean;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationsResponse {
  conversations: ConversationSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface MessageDetail {
  id: string;
  messageId: string;
  senderId: string;
  recipientId: string;
  text: string | null;
  timestamp: string;
  isFromPage: boolean;
  conversationId: string;
  senderName?: string | null;
}

export interface MessagesResponse {
  messages: MessageDetail[];
  total: number;
  page: number;
  limit: number;
}

export interface PageAISettings {
  id?: string;
  pageId: string;
  aiEnabled: boolean;
  aiPersonality: string;
  customInstructions: string | null;
  autoReply: boolean;
  responseTone: string;
  responseLength: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AISettingsResponse {
  settings: PageAISettings;
}

export interface SendReplyRequest {
  message: string;
}

export interface SendReplyResponse {
  success: boolean;
  message: string;
  messageId: string;
}

// ==================== API FUNCTIONS ====================

/**
 * Get Facebook page insights (followers, engagement, reach, etc.)
 */
export async function getPageInsights(pageId: string): Promise<PageInsightsResponse> {
  return apiRequest<PageInsightsResponse>(`/api/pages/${pageId}/insights`);
}

/**
 * Get conversations for a specific page with optional filters
 */
export async function getPageConversations(
  pageId: string,
  params?: { status?: string; limit?: number; offset?: number }
): Promise<ConversationsResponse> {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.append('status', params.status);
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());

  const query = queryParams.toString();
  return apiRequest<ConversationsResponse>(
    `/api/pages/${pageId}/conversations${query ? `?${query}` : ''}`
  );
}

/**
 * Get message history for a specific page with optional filters
 */
export async function getPageMessages(
  pageId: string,
  params?: {
    dateFrom?: string;
    dateTo?: string;
    type?: 'incoming' | 'outgoing';
    limit?: number;
    offset?: number;
  }
): Promise<MessagesResponse> {
  const queryParams = new URLSearchParams();
  if (params?.dateFrom) queryParams.append('dateFrom', params.dateFrom);
  if (params?.dateTo) queryParams.append('dateTo', params.dateTo);
  if (params?.type) queryParams.append('type', params.type);
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());

  const query = queryParams.toString();
  return apiRequest<MessagesResponse>(
    `/api/pages/${pageId}/messages${query ? `?${query}` : ''}`
  );
}

/**
 * Get AI settings for a specific page
 */
export async function getPageAISettings(pageId: string): Promise<AISettingsResponse> {
  return apiRequest<AISettingsResponse>(`/api/pages/${pageId}/ai-settings`);
}

/**
 * Update AI settings for a specific page
 */
export async function updatePageAISettings(
  pageId: string,
  settings: Partial<Omit<PageAISettings, 'id' | 'pageId' | 'createdAt' | 'updatedAt'>>
): Promise<AISettingsResponse> {
  return apiRequest<AISettingsResponse>(`/api/pages/${pageId}/ai-settings`, {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

/**
 * Update conversation status (close/resolve/archive)
 */
export async function updateConversationStatus(
  conversationId: string,
  status: 'active' | 'resolved' | 'archived'
): Promise<{ conversation: any }> {
  return apiRequest(`/api/pages/conversations/${conversationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

/**
 * Get all messages for a specific conversation
 */
export async function getConversationMessages(
  conversationId: string
): Promise<{
  conversation: { id: string; senderName: string | null; senderId: string; status: string; platform: string };
  messages: Array<{ id: string; text: string | null; timestamp: string; isFromPage: boolean; senderId: string }>;
}> {
  return apiRequest(`/api/pages/conversations/${conversationId}/messages`);
}

/**
 * Send a manual reply to a conversation
 */
export async function sendReply(
  conversationId: string,
  message: string
): Promise<SendReplyResponse> {
  return apiRequest<SendReplyResponse>(`/api/pages/conversations/${conversationId}/reply`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

// ==================== PAGE SUMMARY + AGENT GENERATION ====================

export interface PageSummary {
  id: string;
  platform: string;
  pageId: string;
  pageName: string;
  pictureUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  conversations: { total: number; active: number; resolved: number; archived: number; unread: number };
  messages: { last7d: number; last24h: number; incoming7d: number; outgoing7d: number };
  products: number;
  agent: { enabled: boolean; autoReply: boolean; personality: string | null; hasInstructions: boolean };
  lastActivity: string | null;
}

export async function getPageSummary(pageId: string): Promise<PageSummary> {
  return apiRequest<PageSummary>(`/api/pages/${pageId}/summary`);
}

export interface GeneratedAgent {
  personality: 'professional' | 'friendly' | 'casual' | 'technical';
  responseTone: 'balanced' | 'formal' | 'casual' | 'enthusiastic';
  responseLength: 'short' | 'medium' | 'detailed';
  customInstructions: string;
  businessSummary: string;
  languages: string[];
  topQuestions: string[];
  sampledMessages: number;
  sampledConversations: number;
  warning: string | null;
}

export async function generatePageAgent(pageId: string): Promise<GeneratedAgent> {
  return apiRequest<GeneratedAgent>(`/api/pages/${pageId}/generate-agent`, { method: 'POST' });
}

/**
 * Apply a generated agent draft as a real Agent record + link to this page.
 * Returns { agent, created } where agent is the persisted Agent row.
 */
export async function applyPageAgent(
  pageId: string,
  draft: {
    personality: GeneratedAgent['personality'];
    responseTone: GeneratedAgent['responseTone'];
    responseLength: GeneratedAgent['responseLength'];
    customInstructions: string;
    businessSummary: string;
  },
): Promise<{ agent: any; created: boolean }> {
  return apiRequest(`/api/pages/${pageId}/apply-agent`, {
    method: 'POST',
    body: JSON.stringify(draft),
  });
}

// ==================== SYNC + AI PAGE ANALYSIS ====================

export interface SyncResult {
  newConversations: number;
  newMessages: number;
  totalConversations: number;
  totalMessages: number;
}

export async function syncPageFromFacebook(pageId: string): Promise<SyncResult> {
  return apiRequest<SyncResult>(`/api/pages/${pageId}/sync`, { method: 'POST' });
}

export interface ExtractedProduct {
  postId: string;
  name: string;
  description: string;
  priceDA: number;
  imageUrl: string | null;
  category: string | null;
  sourceText: string;
}

export interface AnalyzeResult {
  pageName: string;
  pageId: string;
  scanned: number;
  extracted: ExtractedProduct[];
  warning: string | null;
}

export async function analyzePagePosts(pageId: string, limit = 30): Promise<AnalyzeResult> {
  return apiRequest<AnalyzeResult>(`/api/pages/${pageId}/analyze?limit=${limit}`, { method: 'POST' });
}

export async function importExtractedProducts(
  pageId: string,
  items: Array<{ name: string; description?: string; priceDA: number; quantity?: number; imageUrl?: string | null; sourcePostId?: string }>,
): Promise<{ created: number; skipped: number }> {
  return apiRequest(`/api/pages/${pageId}/import-products`, {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}
