// Helpers of the M5 clients and fee-grid e2e specs: seeds through the real API (fake adapters only).
import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext } from '@playwright/test';
import { API, authHeaders, type Account } from './m1';
import { seedProduct, sku } from './m2';

type Json = Record<string, unknown>;
export type E2eClient = { id: string; name: string; phone: string | null; orderCount: number; totalSpent: number; tags: string[]; riskLevel: 'normal' | 'high' };

const call = async <T>(request: APIRequestContext, a: Account, method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, data?: Json, headers: Record<string, string> = {}): Promise<T> => {
  const res = await request[method](`${API}${path}`, { headers: { ...authHeaders(a), ...headers }, data });
  expect(res.status(), `${method.toUpperCase()} ${path}: ${await res.text()}`).toBeLessThan(300);
  if (res.status() === 204) return null as T;
  return ((await res.json()) as { data: T }).data;
};

const ready = async (request: APIRequestContext, a: Account, path: string) => {
  try {
    return (await request.get(`${API}${path}`, { headers: authHeaders(a), timeout: 5000 })).ok();
  } catch {
    return false;
  }
};
/** True when the M5 clients endpoints answer (the specs skip themselves otherwise, with the reason). */
export const clientsReady = (request: APIRequestContext, a: Account) => ready(request, a, '/clients?pageSize=25');
export const feesReady = (request: APIRequestContext, a: Account) => ready(request, a, '/delivery/fees');

/** A unique valid DZ mobile number in national form. */
let seq = 0;
export const nextMobile = () => {
  seq += 1;
  const n = (Date.now() + seq * 7919) % 100_000_000;
  return `06${String(n).padStart(8, '0')}`;
};

export const seedClient = (request: APIRequestContext, a: Account, data: Json) => call<E2eClient>(request, a, 'post', '/clients', { name: 'Amina Belkacem', ...data });
export const getClient = (request: APIRequestContext, a: Account, id: string) => call<E2eClient & { metrics: { orders: number; spent: number } }>(request, a, 'get', `/clients/${id}`);
export const listClients = (request: APIRequestContext, a: Account, query = '') => call<E2eClient[]>(request, a, 'get', `/clients${query}`);

/** A tracked product with stock, and one order of it for the client (status `new`, home delivery in wilaya 16). */
export async function seedOrderFor(request: APIRequestContext, a: Account, clientId: string, o: { price?: number; status?: 'new' | 'confirmed' } = {}) {
  const product = await seedProduct(request, a, { name: `Robe ${sku('R')}`, sku: sku('RB'), price: o.price ?? 4900, stock: 20 });
  // a confirmed order needs wilaya + commune + address (04 §1.6): first commune of Alger
  const communes = ((await (await request.get(`${API}/geo/wilayas/16/communes`)).json()) as { data: { id: number }[] }).data;
  return call<{ id: string; number: string; total: number; version: number; status: string }>(
    request,
    a,
    'post',
    '/orders',
    {
      client: { id: clientId },
      items: [{ productId: product.id, quantity: 1 }],
      delivery: { wilayaId: 16, communeId: communes[0]!.id, isStopdesk: false, address: 'Cité 200 logements, bât. C, Alger' },
      paymentMethod: 'cash',
      status: o.status ?? 'new',
    },
    { 'Idempotency-Key': randomUUID() },
  );
}

/** Marks an order delivered (COD) so the client aggregates move (AT-CLI-05). */
export const deliverOrder = (request: APIRequestContext, a: Account, orderId: string) => call<Json>(request, a, 'post', `/orders/${orderId}/deliver`, {}, { 'Idempotency-Key': randomUUID() });

export type E2eFeeRow = { wilayaId: number; code: string; nameFr: string; homePrice: number; stopdeskPrice: number; returnPrice: number; isActive: boolean; source: 'default' | 'custom' };
export const getFees = async (request: APIRequestContext, a: Account) => {
  const res = await request.get(`${API}/delivery/fees`, { headers: authHeaders(a) });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()) as { data: E2eFeeRow[]; meta: { freeDeliveryThreshold: number | null; custom: number; inactive: number; missing: number } };
};
export const putFee = (request: APIRequestContext, a: Account, wilayaId: number, data: Json) => call<E2eFeeRow>(request, a, 'put', `/delivery/fees/${wilayaId}`, data);
