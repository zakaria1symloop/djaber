// Helpers of the M8 analytics & reports e2e specs. Everything talks to the REAL API + worker (fake adapters only):
// figures come from sales / orders / parcels created through the same endpoints as the screens.
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { API, authHeaders, type Account } from './m1';
import { apiCall } from './m5-orders';

/** True when the M8 analytics endpoints answer (the specs skip themselves otherwise, with the reason). */
export async function analyticsReady(request: APIRequestContext, a: Account): Promise<boolean> {
  try {
    return (await request.get(`${API}/analytics/overview`, { headers: authHeaders(a), timeout: 10_000 })).ok();
  } catch {
    return false;
  }
}
export async function reportsReady(request: APIRequestContext, a: Account): Promise<boolean> {
  try {
    return (await request.get(`${API}/reports`, { headers: authHeaders(a), timeout: 10_000 })).ok();
  } catch {
    return false;
  }
}

export async function apiGet<T>(request: APIRequestContext, a: Account, path: string): Promise<T> {
  const r = await apiCall<T>(request, a, 'GET', path);
  expect(r.status, `GET ${path}: ${JSON.stringify(r.error)}`).toBeLessThan(300);
  return r.data;
}

/** `YYYY-MM-DD` n days before today in Africa/Algiers. */
export const algiersDay = (daysAgo = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() - daysAgo * 86_400_000));

/** Digits of a figure whatever the thousands separator ("3 000", "3 000"). */
export const digits = (n: number) => new RegExp(String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\\s?'));

export const kpi = (page: Page, name: string) => page.locator(`[data-kpi="${name}"]`).first();

/** Waits until a background job of the workspace is finished (`GET /jobs/:id`). */
export async function waitJob(request: APIRequestContext, a: Account, jobId: string, timeoutMs = 60_000): Promise<{ status: string; resultUrl: string | null; result: unknown }> {
  let last: { status: string; resultUrl: string | null; result: unknown } | null = null;
  await expect(async () => {
    last = await apiGet<{ status: string; resultUrl: string | null; result: unknown }>(request, a, `/jobs/${jobId}`);
    expect(['done', 'partial', 'failed', 'cancelled']).toContain(last.status);
  }).toPass({ timeout: timeoutMs, intervals: [500, 1000, 2000] });
  return last!;
}
