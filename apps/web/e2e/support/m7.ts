// Helpers of the M7 GDS operations e2e specs (suppliers, purchases, sales, cash register, inventory counts,
// recommendations, carry-overs). Everything talks to the REAL API (fake adapters only): seeds go through the same
// endpoints as the screens (`POST /suppliers`, `/purchases` + Idempotency-Key, `/sales`, `/cash`, `/inventories`).
import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { API, authHeaders, type Account } from './m1';
import { setStockMode } from './m2';
import { apiCall, shopOwner } from './m5-orders';

type Json = Record<string, unknown>;
export type Actions = { key: string; enabled: boolean; reasonCode?: string }[];
export type SeedSupplier = { id: string; name: string; actions: Actions };
export type SeedPurchase = { id: string; number: string; status: string; total: number; remaining: number; items: { id: string; quantity: number; receivedQty: number }[]; actions: Actions };
export type SeedSale = { id: string; number: string; status: string; total: number; remaining: number; paymentStatus: string; actions: Actions };
export type SeedProduct = { id: string; name: string; sku: string; price: number; costPrice: number | null; variants?: { id: string; name: string }[] };

const idem = () => ({ 'Idempotency-Key': randomUUID() });
const ok = <T>(r: { status: number; data: T; error?: { code: string } }, what: string): T => {
  expect(r.status, `${what}: ${JSON.stringify(r.error)}`).toBeLessThan(300);
  return r.data;
};

/** True when the M7 GDS endpoints answer (the specs skip themselves otherwise, with the reason). */
export async function gdsReady(request: APIRequestContext, a: Account): Promise<boolean> {
  try {
    return (await request.get(`${API}/suppliers?pageSize=25`, { headers: authHeaders(a), timeout: 5000 })).ok();
  } catch {
    return false;
  }
}

/** An Owner of a fresh workspace in advanced stock mode (GDS operations are advanced-mode screens). */
export async function gdsOwner(request: APIRequestContext, prefix: string): Promise<Account> {
  const a = await shopOwner(request, prefix);
  await setStockMode(request, a, 'advanced');
  return a;
}

export async function product(request: APIRequestContext, a: Account, o: { name: string; price?: number; cost?: number; stock?: number; trackStock?: boolean; minStock?: number }): Promise<SeedProduct> {
  const body: Json = { name: o.name, sku: `M7-${randomUUID().slice(0, 8).toUpperCase()}`, price: o.price ?? 4500, ...(o.cost !== undefined ? { costPrice: o.cost } : {}), ...(o.minStock !== undefined ? { minStock: o.minStock } : {}) };
  if (o.trackStock === false) body.trackStock = false;
  else body.stock = o.stock ?? 10;
  return ok(await apiCall<SeedProduct>(request, a, 'POST', '/products', body), 'POST /products');
}

export const supplier = async (request: APIRequestContext, a: Account, name: string, extra: Json = {}) => ok(await apiCall<SeedSupplier>(request, a, 'POST', '/suppliers', { name, ...extra }), 'POST /suppliers');

export async function purchase(request: APIRequestContext, a: Account, o: { supplierId: string; lines: { productId: string; quantity: number; unitCost: number; variantId?: string }[]; status?: 'draft' | 'pending'; amountPaid?: number; expectedAt?: string }): Promise<SeedPurchase> {
  return ok(
    await apiCall<SeedPurchase>(request, a, 'POST', '/purchases', { supplierId: o.supplierId, items: o.lines, status: o.status ?? 'pending', ...(o.amountPaid ? { amountPaid: o.amountPaid, paymentMethod: 'cash' } : {}), ...(o.expectedAt ? { expectedAt: o.expectedAt } : {}) }, idem()),
    'POST /purchases',
  );
}

export async function receiveAll(request: APIRequestContext, a: Account, p: SeedPurchase): Promise<SeedPurchase> {
  return ok(await apiCall<SeedPurchase>(request, a, 'POST', `/purchases/${p.id}/receive`, { items: p.items.map((i) => ({ id: i.id, receivedQty: i.quantity - i.receivedQty })) }, idem()), 'POST /purchases/:id/receive');
}

export async function sale(request: APIRequestContext, a: Account, o: { lines: { productId: string; quantity: number; variantId?: string }[]; amountPaid: number; clientId?: string; client?: { name: string; phone: string }; method?: string; status?: 'draft' | 'completed' }): Promise<SeedSale> {
  return ok(
    await apiCall<SeedSale>(request, a, 'POST', '/sales', { items: o.lines, amountPaid: o.amountPaid, paymentMethod: o.method ?? 'cash', ...(o.clientId ? { clientId: o.clientId } : {}), ...(o.client ? { client: o.client } : {}), ...(o.status ? { status: o.status } : {}) }, idem()),
    'POST /sales',
  );
}

export async function cashEntry(request: APIRequestContext, a: Account, o: { type: 'income' | 'expense'; amount: number; category: string; description: string; date?: string }) {
  return ok(await apiCall<{ id: string; actions: Actions }>(request, a, 'POST', '/cash', { method: 'cash', ...o }, idem()), 'POST /cash');
}

export const getJson = async <T = Json>(request: APIRequestContext, a: Account, path: string): Promise<T> => ok(await apiCall<T>(request, a, 'GET', path), `GET ${path}`);

/** `YYYY-MM-DD` of today in Africa/Algiers (the cash register day). */
export const algiersToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const algiersDaysAgo = (n: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() - n * 86_400_000));

/** Opens the `Actions ⌄` menu of a table row (or card) and returns the menu. */
export async function openRowMenu(page: Page, id: string) {
  await page.locator(`tr[data-row="${id}"]`).getByRole('button', { name: /Actions/ }).click();
  return page.getByRole('menu');
}
