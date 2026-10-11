// Helpers of the M2 e2e specs: catalogue seeds through the real API (fake adapters only, nothing leaves the machine).
import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext } from '@playwright/test';
import { API, authHeaders, type Account } from './m1';

type Json = Record<string, unknown>;
export type SeedProduct = { id: string; sku: string; name: string; version: number; variants: { id: string; name: string; stock: number }[] };

const post = async <T>(request: APIRequestContext, a: Account, path: string, data: Json, headers: Record<string, string> = {}): Promise<T> => {
  const res = await request.post(`${API}${path}`, { headers: { ...authHeaders(a), ...headers }, data });
  expect(res.status(), `POST ${path}: ${await res.text()}`).toBeLessThan(300);
  return ((await res.json()) as { data: T }).data;
};

/** True when the M2 catalogue endpoints answer (the specs skip themselves otherwise, with the reason). */
export async function catalogReady(request: APIRequestContext, a: Account): Promise<boolean> {
  try {
    return (await request.get(`${API}/products?pageSize=25`, { headers: authHeaders(a), timeout: 5000 })).ok();
  } catch {
    return false;
  }
}

export async function setStockMode(request: APIRequestContext, a: Account, stockMode: 'simple' | 'advanced') {
  const res = await request.patch(`${API}/workspace`, { headers: authHeaders(a), data: { stockMode } });
  expect(res.ok(), await res.text()).toBeTruthy();
}

export const seedCategory = (request: APIRequestContext, a: Account, name: string, extra: Json = {}) => post<{ id: string; name: string }>(request, a, '/categories', { name, ...extra });

/** `POST /products` — a tracked product needs `stock` unless it has `variants`; `trackStock: false` = service. */
export const seedProduct = (request: APIRequestContext, a: Account, data: Json) =>
  post<SeedProduct>(request, a, '/products', { price: 1000, ...(data.trackStock === false || data.variants ? {} : { stock: 10 }), ...data });

export const adjustStock = (request: APIRequestContext, a: Account, data: Json) => post<Json>(request, a, '/stock/adjustments', { reason: 'correction', ...data }, { 'Idempotency-Key': randomUUID() });

export async function archiveProduct(request: APIRequestContext, a: Account, id: string) {
  const res = await request.delete(`${API}/products/${id}?mode=archive`, { headers: authHeaders(a) });
  expect(res.status(), await res.text()).toBeLessThan(300);
}

export async function getProduct(request: APIRequestContext, a: Account, id: string) {
  const res = await request.get(`${API}/products/${id}`, { headers: authHeaders(a) });
  expect(res.ok(), await res.text()).toBeTruthy();
  return ((await res.json()) as { data: SeedProduct & Json }).data;
}

/** A unique SKU per run (accounts may be reused between local runs). */
export const sku = (prefix: string) => `${prefix}-${randomUUID().slice(0, 6).toUpperCase()}`;
