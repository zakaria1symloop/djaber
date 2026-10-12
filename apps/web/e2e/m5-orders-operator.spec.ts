// M5 — Operator view of the order screens (01-nest-module-map §3.2, `packages/shared/src/permissions.ts`): an Operator
// reads and works orders (`orders.read`, `orders.write`: calls, confirm, callback, assign, address, payments) but every
// `orders.money` item (export, delete, fee override, delivered → returned) is hidden or greyed — the API refuses too.
// Real API, nothing mocked.
import { expect, test } from '@playwright/test';
import { apiReady, type Account } from './support/m1';
import { signIn } from './support/m4-agents';
import { operatorOf } from './support/m4-inbox';
import { apiCall, open, ordersReady, row, seedOrder, seedProduct, setStatus, shopOwner, type SeedOrder } from './support/m5-orders';

test.describe.configure({ mode: 'serial', timeout: 240_000 });
test.use({ viewport: { width: 1440, height: 1000 } });

let owner: Account;
let operator: Account;
let fresh: SeedOrder;
let delivered: SeedOrder;

test.beforeAll(async ({ request }) => {
  test.setTimeout(360_000);
  test.skip(!(await apiReady(request)), 'API not reachable on :4010');
  owner = await shopOwner(request, 'm5ordop');
  test.skip(!(await ordersReady(request, owner)), 'orders module (M5) not served');
  operator = await operatorOf(request, owner, 'm5ordop-op');
  const product = await seedProduct(request, owner, 'Foulard soie', 2400);
  fresh = await seedOrder(request, owner, { productId: product.id });
  delivered = await seedOrder(request, owner, { productId: product.id, status: 'confirmed' });
  await setStatus(request, owner, delivered.id, 'delivered');
});

test('Operator on /orders: no Exporter, selection allowed, delete never offered', async ({ page }) => {
  await signIn(page, operator);
  await open(page, '/fr/orders', () => row(page, fresh.id));
  await expect(page.getByRole('button', { name: 'Exporter' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '+ Nouvelle commande' })).toBeVisible();
  await row(page, fresh.id).getByRole('checkbox').check();
  await expect(page.getByRole('region', { name: 'Actions groupées' }).getByRole('button', { name: 'Exporter' })).toHaveCount(0);
  await row(page, fresh.id).getByRole('button', { name: /Actions/ }).click();
  const remove = page.getByRole('menu').getByRole('menuitem', { name: 'Supprimer' });
  if ((await remove.count()) > 0) await expect(remove).toHaveAttribute('data-disabled', '');
  await page.keyboard.press('Escape');
});

test('Operator on a delivered order: "Marquer retournée" is greyed (Admin+) and the API refuses delete', async ({ page, request }) => {
  await signIn(page, operator);
  await open(page, `/fr/orders/${delivered.id}`, () => page.getByTestId('client-block'));
  await page.getByRole('button', { name: 'Actions' }).click();
  const ret = page.getByRole('menu').getByRole('menuitem', { name: 'Marquer retournée' });
  if ((await ret.count()) > 0) await expect(ret).toHaveAttribute('data-disabled', '');
  await page.keyboard.press('Escape');
  const r = await apiCall(request, operator, 'DELETE', `/orders/${delivered.id}?confirmNumber=${delivered.number}`);
  expect(r.status).toBe(403);
});
