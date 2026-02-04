/**
 * API Client for Djaber.ai Backend
 */

import { API_BASE_URL, getAuthHeader, apiRequest as baseApiRequest } from './api-config';

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
      if (data.errors && Array.isArray(data.errors)) {
        const errorMessages = data.errors.map((err: any) => err.msg).join(', ');
        throw new Error(errorMessages);
      }
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
  };
}

export interface ProfileResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    plan: string;
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
