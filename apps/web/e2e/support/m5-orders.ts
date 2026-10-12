// Helpers of the M5 orders e2e specs (list, order page, dialogs, print). Everything talks to the REAL API: orders are
// created through `POST /orders` (Idempotency-Key), products through `POST /products`; the fake adapters only.
import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { API, authHeaders, createAccount, type Account } from './m1';
import { freshToken } from './m4-inbox';

type Json = Record<string, unknown>;
export type SeedOrder = { id: string; number: string; status: string; version: number; total: number; clientPhone: string; actions: { key: string; enabled: boolean; reasonCode?: string }[] };

/** A unique mobile number per call ("05" + 8 digits): clients are found by phone. */
export const uniquePhone = () => `05${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;

async function call<T>(request: APIRequestContext, a: Account, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, data?: Json, headers: Record<string, string> = {}): Promise<{ status: number; data: T; error?: { code: string } }> {
  await freshToken(request, a);
  const res = await request.fetch(`${API}${path}`, { method, headers: { ...authHeaders(a), ...headers }, ...(data === undefined ? {} : { data }) });
  const text = await res.text();
  const body: { data: T; error?: { code: string } } = text ? (JSON.parse(text) as { data: T; error?: { code: string } }) : { data: null as T };
  return { status: res.status(), data: body.data, error: body.error };
}
export const apiCall = call;

/** True when the M5 orders endpoints answer (the specs skip themselves otherwise, with the reason). */
export async function ordersReady(request: APIRequestContext, a: Account): Promise<boolean> {
  try {
    return (await request.get(`${API}/orders?pageSize=25`, { headers: authHeaders(a), timeout: 5000 })).ok();
  } catch {
    return false;
  }
}

export async function shopOwner(request: APIRequestContext, prefix: string): Promise<Account> {
  return createAccount(request, { prefix, firstName: 'Zakaria', finishOnboarding: true });
}

/** A tracked product with stock (once per call). */
export async function seedProduct(request: APIRequestContext, a: Account, name = 'Parfum Oud', price = 4700, stock = 30): Promise<{ id: string; name: string }> {
  const r = await call<{ id: string; name: string }>(request, a, 'POST', '/products', { name, sku: `M5-${randomUUID().slice(0, 8).toUpperCase()}`, price, stock });
  expect(r.status, JSON.stringify(r.error)).toBeLessThan(300);
  return r.data;
}

/** First commune of a wilaya (seeded reference data). */
export async function communeOf(request: APIRequestContext, wilayaId: number): Promise<number> {
  const res = await request.get(`${API}/geo/wilayas/${wilayaId}/communes`);
  expect(res.ok(), await res.text()).toBeTruthy();
  const list = ((await res.json()) as { data: { id: number }[] }).data;
  expect(list.length, `communes of wilaya ${wilayaId}`).toBeGreaterThan(0);
  return list[0]!.id;
}

/**
 * `POST /orders` (Idempotency-Key). `address: false` creates an order without delivery block (confirm blocked by
 * ORDER_ADDRESS_REQUIRED); `status: 'confirmed'` needs the address.
 */
export async function seedOrder(
  request: APIRequestContext,
  a: Account,
  o: { productId: string; quantity?: number; name?: string; phone?: string; address?: boolean; status?: 'new' | 'confirmed'; amountPaid?: number; wilayaId?: number } ,
): Promise<SeedOrder> {
  const wilayaId = o.wilayaId ?? 16;
  const delivery = o.address === false ? undefined : { wilayaId, communeId: await communeOf(request, wilayaId), isStopdesk: false, address: 'Cité 500 logements, bât. 12, n° 4' };
  const r = await call<SeedOrder>(
    request,
    a,
    'POST',
    '/orders',
    {
      client: { name: o.name ?? 'Amina Belkacem', phone: o.phone ?? uniquePhone() },
      items: [{ productId: o.productId, quantity: o.quantity ?? 1 }],
      ...(delivery ? { delivery } : {}),
      paymentMethod: 'cash',
      status: o.status ?? 'new',
      ...(o.amountPaid ? { amountPaid: o.amountPaid } : {}),
    },
    { 'Idempotency-Key': randomUUID() },
  );
  expect(r.status, `POST /orders: ${JSON.stringify(r.error)}`).toBeLessThan(300);
  return r.data;
}

export async function getOrder(request: APIRequestContext, a: Account, id: string): Promise<SeedOrder & Json> {
  const r = await call<SeedOrder & Json>(request, a, 'GET', `/orders/${id}`);
  expect(r.status).toBe(200);
  return r.data;
}

/** `POST /orders/:id/status` through the API (fixture states: delivered, shipped…). */
export async function setStatus(request: APIRequestContext, a: Account, id: string, to: string, extra: Json = {}) {
  const o = await getOrder(request, a, id);
  const r = await call(request, a, 'POST', `/orders/${id}/status`, { to, version: o.version, ...extra }, { 'Idempotency-Key': randomUUID() });
  expect(r.status, `status → ${to}: ${JSON.stringify(r.error)}`).toBeLessThan(300);
}

/* ---------- page helpers ---------- */
export const row = (page: Page, id: string): Locator => page.locator(`tr[data-row="${id}"]`);
export const dialog = (page: Page): Locator => page.getByRole('dialog');

/** Opens a screen and waits for its ready element (first hits compile on the shared server). */
export async function open(page: Page, url: string, ready: () => Locator) {
  await expect(async () => {
    await page.goto(url);
    await expect(ready()).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 120_000 });
}

/** Opens the `Actions ⌄` menu of a row and picks an item by its label. */
export async function rowAction(page: Page, id: string, label: string | RegExp) {
  await row(page, id).getByRole('button', { name: /Actions/ }).click();
  await page.getByRole('menuitem', { name: label }).click();
}

/** Digits of an amount whatever the thousands separator ("12 500", "12 500"). */
export const money = (n: number) => new RegExp(`${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\\s?')}\\s?DA`);
