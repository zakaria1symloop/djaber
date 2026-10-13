// Helpers of the M10 moderation (ADM-10) and abuse-report (ADM-11) specs — real API on :4010, fake drivers only.
// Platform admins come from the shared M10 helper (`platformAdmin`: account → 2FA → platformRole in the dev DB).
import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { API, authHeaders, expectUrl, login, totp, type Account } from './m1';
import { adminHeaders, platformAdmin, sql, type Admin, type PlatformRole } from './m10-help';

export { sql };
export type ModAdmin = Admin & { usedWindow: number };

const window30 = () => Math.floor(Date.now() / 30_000);

/** Platform admin of `role`, remembering the TOTP window its API login used (a code is accepted once per window). */
export async function modAdmin(request: APIRequestContext, role: PlatformRole, prefix = 'm10mod'): Promise<ModAdmin> {
  const a = await platformAdmin(request, role, prefix);
  return { ...a, usedWindow: window30() };
}

/** Browser login of a platform admin: password, then the 2FA step with a code of a window not used yet. */
export async function loginAdmin(page: Page, a: ModAdmin, path = '/fr/admin') {
  await login(page, a);
  await expect(page.getByRole('heading', { name: 'Vérification en deux étapes' })).toBeVisible();
  while (window30() <= a.usedWindow || 30_000 - (Date.now() % 30_000) < 4_000) await new Promise((r) => setTimeout(r, 1_000));
  a.usedWindow = window30();
  await page.getByRole('textbox', { name: 'Code à 6 chiffres 1' }).click();
  await page.keyboard.type(totp(a.secret));
  await expectUrl(page, /\/fr\/(home|admin)/);
  if (path) {
    await page.goto(path);
    // the admin shell boots the session (GET /me) before the page heading shows
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
  }
}

const call = async <T>(request: APIRequestContext, method: 'get' | 'post' | 'put' | 'delete', path: string, headers: Record<string, string>, data?: unknown): Promise<T> => {
  const res = await request[method](`${API}${path}`, { headers, data });
  const body = await res.json().catch(() => null);
  expect(res.status(), `${method.toUpperCase()} ${path} → ${res.status()} ${JSON.stringify(body)}`).toBeLessThan(300);
  return (body as { data: T } | null)?.data as T;
};
export const asAdmin = <T>(request: APIRequestContext, a: Admin, method: 'get' | 'post' | 'put' | 'delete', path: string, data?: unknown) => call<T>(request, method, path, adminHeaders(a), data);
export const asMerchant = <T>(request: APIRequestContext, a: Account, method: 'get' | 'post' | 'put' | 'delete', path: string, data?: unknown) => call<T>(request, method, path, authHeaders(a), data);

/** True when the ADM-10 routes answer for this admin (the API of contract-b is deployed). */
export async function moderationReady(request: APIRequestContext, a: Admin): Promise<boolean> {
  const r = await request.get(`${API}/admin/moderation/stats`, { headers: adminHeaders(a) });
  return r.ok();
}

type Item = { id: string; status: string; product: { id: string; name: string } | null; aiScore: number | null; aiFlags: { code: string }[] };

/**
 * A product in the human queue: an active `protected_brand` rule (unique word) and a product whose name carries it — the
 * pre-screen flags it (contract-b "How to produce each state in dev"). Returns the product and its pending item.
 */
export async function pendingProduct(request: APIRequestContext, admin: Admin, merchant: Account, o: { name?: string } = {}) {
  const brand = `brand${randomUUID().slice(0, 6)}`;
  await asAdmin(request, admin, 'post', '/admin/moderation/rules', { key: `protected_brand.${brand}`, kind: 'protected_brand', value: brand, isActive: true });
  const name = o.name ?? `Parfum ${brand} 100 ml`;
  const product = await asMerchant<{ id: string }>(request, merchant, 'post', '/products', { name, price: 1800, stock: 5, sku: `MOD-${randomUUID().slice(0, 6)}` });
  const item = await waitForItem(request, admin, product.id, (i) => i.status === 'pending');
  return { product, item, name };
}

/** Polls the queue until the item of a product reaches a state (the pre-screen runs in the worker). */
export async function waitForItem(request: APIRequestContext, admin: Admin, productId: string, ok: (i: Item) => boolean, timeoutMs = 30_000): Promise<Item> {
  const until = Date.now() + timeoutMs;
  let last: Item | undefined;
  while (Date.now() < until) {
    const rows = await asAdmin<Item[]>(request, admin, 'get', `/admin/moderation/items?pageSize=100&sort=-submittedAt`);
    last = rows.find((r) => r.product?.id === productId);
    if (last && ok(last)) return last;
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error(`moderation item of ${productId} not in the expected state: ${JSON.stringify(last)}`);
}

/** Makes an item urgent now (its SLA of 2 business hours cannot be waited for in a test). */
export const breachSla = (itemId: string) => sql(`UPDATE "ModerationItem" SET "priority" = 'urgent', "slaDueAt" = now() - interval '1 minute' WHERE "id" = $1::uuid`, itemId);

/** A merchant report on one of its clients (`POST /safety/reports`), found back in the admin list. */
export async function customerReport(request: APIRequestContext, admin: Admin, merchant: Account, phone: string) {
  const client = await asMerchant<{ id: string }>(request, merchant, 'post', '/clients', { name: 'Walid H.', phone });
  await asMerchant(request, merchant, 'post', '/safety/reports', { type: 'customer', clientId: client.id, reason: 'harassment', details: 'Insultes répétées envers l’équipe' });
  const rows = await asAdmin<{ id: string; target: { id: string } }[]>(request, admin, 'get', `/admin/reports?workspaceId=${merchant.workspaceId}&pageSize=100`);
  const report = rows.find((r) => r.target.id === client.id) ?? rows[0];
  expect(report, 'report visible to the platform').toBeTruthy();
  return { client, report: report! };
}
