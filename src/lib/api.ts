/**
 * API Client for Djaber.ai Backend
 */

import { API_BASE_URL, getAuthHeader, apiRequest as baseApiRequest, ApiError, getLangHeader } from './api-config';

/**
 * Unauthenticated variant (login / register): same ApiError contract as
 * api-config — `message` is translated by the backend, `code` is stable and
 * `fields` carries per-field validation errors. For a validation failure the
 * message becomes the joined field messages so forms can show them directly.
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
      ...getLangHeader(),
      ...options.headers,
    },
  };

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch {
    throw new ApiError(0, { code: 'NETWORK_ERROR' });
  }
  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    const err = new ApiError(response.status, data);
    if (err.fields.length > 0) {
      err.message = err.fields.map((f) => f.message).join(', ');
    }
    throw err;
  }

  return data as T;
}

// ============================================================================
// Authentication API
// ============================================================================

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  plan?: 'individual' | 'teams';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    plan: string;
    isAdmin?: boolean;
  };
}

export interface ProfileResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    plan: string;
    isAdmin?: boolean;
    createdAt: string;
  };
}

/**
 * Register a new user
 */
export async function register(data: RegisterRequest): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Login existing user
 */
export async function login(data: LoginRequest): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get current user profile (requires authentication)
 */
export async function getProfile(): Promise<ProfileResponse> {
  return apiRequest<ProfileResponse>('/api/auth/profile', {
    headers: getAuthHeader(),
  });
}

/**
 * Logout user (client-side only)
 */
export function logout(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!localStorage.getItem('token');
}

/**
 * Get stored user data
 */
export function getStoredUser(): AuthResponse['user'] | null {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Store auth data after login/register
 */
export function storeAuthData(token: string, user: AuthResponse['user']): void {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

// ============================================================================
// Health Check API
// ============================================================================

export interface HealthResponse {
  status: string;
  message: string;
  timestamp: string;
}

/**
 * Check API health status
 */
export async function healthCheck(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>('/health');
}
