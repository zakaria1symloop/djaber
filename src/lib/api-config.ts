/**
 * Centralized API Configuration
 * All API files import from here — single source of truth.
 */

import { getLang } from './i18n';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6001';

/** One field-level validation error, as returned by the API (already translated). */
export interface ApiFieldError {
  field: string;
  code: string;
  message: string;
  params?: Record<string, unknown>;
}

/**
 * Error thrown by every API helper. `message` is the human text the backend
 * translated for the current language; `code` is the stable key to branch on
 * (e.g. 'AUTH_INVALID_CREDENTIALS', 'PRODUCT_NOT_FOUND', 'VALIDATION_FAILED');
 * `fields` lists per-field validation errors when status is 400.
 */
export class ApiError extends Error {
  status: number;
  code: string;
  fields: ApiFieldError[];
  params?: Record<string, unknown>;
  data?: unknown;

  constructor(status: number, data: any) {
    super(
      (data && (data.message || data.error)) ||
        (status === 0 ? 'Network error' : `Request failed (${status})`)
    );
    this.name = 'ApiError';
    this.status = status;
    this.code = (data && data.code) || (status >= 500 ? 'INTERNAL_ERROR' : 'UNKNOWN');
    this.fields = Array.isArray(data?.fields) ? data.fields : [];
    this.params = data?.params;
    this.data = data;
  }

  /** Message for one field (from `fields`), or undefined. */
  fieldMessage(field: string): string | undefined {
    return this.fields.find((f) => f.field === field)?.message;
  }
}

export function getAuthHeader(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** The backend translates its error messages from this header (en / fr / ar). */
export function getLangHeader(): Record<string, string> {
  try {
    return { 'Accept-Language': getLang() };
  } catch {
    return {};
  }
}

async function parseBody(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getLangHeader(),
      ...getAuthHeader(),
      ...options.headers,
    },
  };

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch {
    throw new ApiError(0, { code: 'NETWORK_ERROR', message: undefined });
  }
  const data = await parseBody(response);

  if (!response.ok) {
    throw new ApiError(response.status, data);
  }

  return data as T;
}

export async function apiUpload<T>(endpoint: string, formData: FormData): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        ...getLangHeader(),
        ...getAuthHeader(),
        // Do NOT set Content-Type — browser sets multipart boundary automatically
      },
      body: formData,
    });
  } catch {
    throw new ApiError(0, { code: 'NETWORK_ERROR', message: undefined });
  }

  const data = await parseBody(response);

  if (!response.ok) {
    throw new ApiError(response.status, data);
  }

  return data as T;
}
