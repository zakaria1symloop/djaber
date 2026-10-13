// Server-side reads of the public API for the server-rendered public pages (route map §3.1, PUB-01…04): CMS entries,
// plans, help articles. Envelope `{ data }` / `{ error }` (api-contract §1). Runs in server components only.
// `API_INTERNAL_URL` (server only) lets the Next server reach the API on another address than the browser does.
import { getMessages, isAppLocale, type AppLocale } from '@djaber/shared';
import { makeT, type TFunction } from './format-message';

const BASE = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4010';

export type PublicResult<T> = { ok: true; data: T } | { ok: false; status: number; code: string; ref: string };

/**
 * One read per render, never kept in the Next data cache: what an admin publishes (CMS, plans) is live on the next
 * page view (assumptions-log M11 web-public). `noStore` is kept for the call sites that must never be cached
 * (preview links) should a cache be introduced later.
 */
export async function publicGet<T>(path: string, o: { locale: AppLocale; query?: Record<string, string | undefined>; noStore?: boolean }): Promise<PublicResult<T>> {
  const url = new URL(`${BASE}/api/v1${path}`);
  for (const [k, v] of Object.entries(o.query ?? {})) if (v !== undefined && v !== '') url.searchParams.set(k, v);
  try {
    const res = await fetch(url, {
      headers: { 'Accept-Language': o.locale, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => null)) as { data?: T; error?: { code?: string; ref?: string } } | null;
    if (res.ok && body && 'data' in body) return { ok: true, data: body.data as T };
    return { ok: false, status: res.status, code: body?.error?.code ?? 'INTERNAL', ref: body?.error?.ref ?? '—' };
  } catch {
    // API unreachable / timeout: the page renders its error state ("Réessayer")
    return { ok: false, status: 0, code: 'NETWORK', ref: '—' };
  }
}

/** What a page section receives: the data, or the request ref of its error state. */
export type Read<T> = { ok: true; data: T } | { ok: false; ref: string };
export const asRead = <T>(r: PublicResult<T>): Read<T> => (r.ok ? { ok: true, data: r.data } : { ok: false, ref: r.ref });
/** Optional CMS block: a 404 (not published) is "no block", not an error. */
export const asOptional = <T>(r: PublicResult<T>): Read<T | null> => (r.ok ? { ok: true, data: r.data } : r.status === 404 ? { ok: true, data: null } : { ok: false, ref: r.ref });

/** Locale of a `[locale]` segment (the layout already 404s an unknown one). */
export const pageLocale = (raw: string): AppLocale => (isAppLocale(raw) ? raw : 'fr');

/** `t()` for server code (metadata). */
export const serverT = (locale: AppLocale): TFunction => makeT(locale, getMessages(locale));
