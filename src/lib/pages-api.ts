/**
 * Pages API - Facebook/Instagram page management
 */

import { getAuthHeader, apiRequest } from './api-config';

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
