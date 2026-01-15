/**
 * Pages API - Facebook/Instagram page management
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

/**
 * Get authorization header with JWT token
 */
function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('token');
  if (!token) {
    return {};
  }
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Generic API request handler
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
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
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error occurred');
  }
}

// ============================================================================
// Page Management API
// ============================================================================

export interface Page {
  id: string;
  platform: 'facebook' | 'instagram';
  pageId: string;
  pageName: string;
  isActive: boolean;
  createdAt: string;
}

export interface GetPagesResponse {
  pages: Page[];
}

export interface ConnectFacebookResponse {
  authUrl: string;
}

export interface DisconnectPageResponse {
  success: boolean;
  message: string;
}

/**
 * Get user's connected pages
 */
export async function getUserPages(): Promise<GetPagesResponse> {
  return apiRequest<GetPagesResponse>('/api/pages', {
    headers: getAuthHeader(),
  });
}

/**
 * Initiate Facebook page connection (OAuth)
 */
export async function connectFacebookPage(): Promise<ConnectFacebookResponse> {
  return apiRequest<ConnectFacebookResponse>('/api/pages/connect/facebook', {
    headers: getAuthHeader(),
  });
}

/**
 * Disconnect a page
 */
export async function disconnectPage(pageId: string): Promise<DisconnectPageResponse> {
  return apiRequest<DisconnectPageResponse>(`/api/pages/${pageId}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
  });
}
