// HTTP client for /api/v1 (api-contract §1): envelope { data, meta } / { error }, access token kept in memory,
// refresh through the httpOnly cookie, X-Workspace-Id, Accept-Language, Idempotency-Key on demand.
import { uuid } from './uuid';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4010';

export type ApiErrorBody = {
  code: string;
  message: string;
  params: Record<string, string | number>;
  fields: Record<string, string>;
  details: unknown;
  ref: string;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody,
  ) {
    super(body.message);
  }
  get code() {
    return this.body.code;
  }
}

export type Meta = { page?: number; pageSize?: number; total?: number; nextCursor?: string | null; hasMore?: boolean; warnings?: { code: string; params?: Record<string, unknown> }[] };
export type Envelope<T> = { data: T; meta: Meta };

type Session = { accessToken: string | null; workspaceId: string | null; locale: string };
const session: Session = { accessToken: null, workspaceId: null, locale: 'fr' };
export type ApiEvent = 'session-expired' | 'offline' | 'online' | 'legal-required' | 'deletion-scheduled';
const listeners = new Set<(event: ApiEvent) => void>();

export const apiSession = {
  set(patch: Partial<Session>) {
    Object.assign(session, patch);
  },
  get: () => session,
  on(fn: (event: ApiEvent) => void) {
    listeners.add(fn);
    return () => void listeners.delete(fn);
  },
};
const emit = (e: ApiEvent) => listeners.forEach((l) => l(e));

let lastWriteAt = 0;
/** Called for every non-GET request of this tab (uploads included). */
export const markOwnWrite = () => {
  lastWriteAt = Date.now();
};
/** Milliseconds since this tab last sent a write: a refreshed resource right after it is our own change, not a foreign one. */
export const msSinceOwnWrite = () => Date.now() - lastWriteAt;

let refreshing: Promise<boolean> | null = null;
/** Exchanges the refresh cookie for a new access token. Shared by concurrent 401s. */
export const refreshSession = (): Promise<boolean> => {
  refreshing ??= fetch(`${API_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'Accept-Language': session.locale },
    body: '{}',
  })
    .then(async (r) => {
      if (!r.ok) return false;
      const json = (await r.json()) as Envelope<{ accessToken: string }>;
      if (!json?.data?.accessToken) return false;
      session.accessToken = json.data.accessToken;
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
};

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined | string[]>;
  /** true ⇒ a random Idempotency-Key is generated; a string is used as the key */
  idempotent?: boolean | string;
  signal?: AbortSignal;
  /** do not try to refresh on 401 (login, refresh itself) */
  noRefresh?: boolean;
  formData?: FormData;
};

const toQuery = (q: RequestOptions['query']) => {
  if (!q) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length) p.set(k, v.join(','));
    } else p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
};

export async function apiRaw<T>(path: string, o: RequestOptions = {}): Promise<Envelope<T>> {
  const headers: Record<string, string> = { 'Accept-Language': session.locale };
  if (session.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
  if (session.workspaceId) headers['X-Workspace-Id'] = session.workspaceId;
  if (o.idempotent) headers['Idempotency-Key'] = typeof o.idempotent === 'string' ? o.idempotent : uuid();
  let body: BodyInit | undefined;
  if (o.formData) body = o.formData;
  else if (o.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(o.body);
  }
  const write = (o.method ?? 'GET') !== 'GET';
  const before = lastWriteAt;
  if (write) markOwnWrite();
  const stamp = lastWriteAt;
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1${path}${toQuery(o.query)}`, {
      method: o.method ?? 'GET',
      headers,
      body,
      credentials: 'include',
      signal: o.signal,
    });
    emit('online');
  } catch (e) {
    if ((e as Error).name !== 'AbortError') emit('offline');
    throw e;
  }
  if (res.status === 401 && !o.noRefresh) {
    if (await refreshSession()) return apiRaw<T>(path, { ...o, noRefresh: true });
    // only a session that existed can expire (anonymous 401s are handled by the caller)
    if (session.accessToken) {
      session.accessToken = null;
      emit('session-expired');
    }
  }
  // a refused or failed write changed nothing on the server: it does not count as "our own write", so a foreign change
  // arriving right after a 409 is still seen as foreign (unless another write of this tab started meanwhile)
  if (write) {
    if (res.ok) markOwnWrite();
    else if (lastWriteAt === stamp) lastWriteAt = before;
  }
  if (res.status === 204) return { data: null as T, meta: {} };
  const json = (await res.json().catch(() => null)) as (Envelope<T> & { error?: ApiErrorBody }) | null;
  if (!res.ok || !json || json.error) {
    const body: ApiErrorBody = {
      code: 'INTERNAL',
      message: res.statusText,
      details: null,
      ref: res.headers.get('x-request-id') ?? '',
      ...json?.error,
      params: { ...json?.error?.params },
      fields: { ...json?.error?.fields },
    };
    // 429: the countdown reads `params.retryAfter` (seconds); fall back to the Retry-After header
    const retryAfter = Number(res.headers.get('retry-after'));
    if (res.status === 429 && body.params.retryAfter === undefined && Number.isFinite(retryAfter) && retryAfter > 0) body.params.retryAfter = retryAfter;
    if (body.code === 'LEGAL_REACCEPT_REQUIRED') emit('legal-required');
    if (body.code === 'WORKSPACE_DELETION_SCHEDULED') emit('deletion-scheduled');
    throw new ApiError(res.status, body);
  }
  return json;
}

/** Returns `data` only. Use `apiRaw` when `meta` (pagination, warnings) is needed. */
export const api = async <T>(path: string, o: RequestOptions = {}): Promise<T> => (await apiRaw<T>(path, o)).data;
