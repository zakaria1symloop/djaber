const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('token');
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Something went wrong');
    }

    return data as T;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Network error occurred');
  }
}

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
