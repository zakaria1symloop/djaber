// M7 — carry-overs and state catalogue: movements KPI tiles + references linked to the purchase (M2), filter-following
// product summary (M2), stock dashboard "ACHATS & FOURNISSEURS" + "Réapprovisionner" → new purchase (M2), product
// expenses & margins editor (GDS-09, DLG GDS II "Dépense produit"), order import CSV through the CAT-06 wizard (M5),
// simple-mode states of the GDS screens (AT-ST-07). Real API + worker: nothing is mocked.
import { expect, test } from '@playwright/test';
import { apiReady, type Account } from './support/m1';
import { setStockMode } from './support/m2';
import { signIn } from './support/m4-agents';
import { open, uniquePhone } from './support/m5-orders';
import { gdsOwner, gdsReady, getJson, product, purchase, receiveAll, supplier, type SeedProduct } from './support/m7';

test.describe.configure({ mode: 'serial', timeout: 240_000 });
test.use({ viewport: { width: 1440, height: 1000 } });

let owner: Account;
let oud: SeedProduct;
let low: SeedProduct;
let purchaseId: string;

test.beforeAll(async ({ request }) => {
  test.setTimeout(300_000);
  test.skip(!(await apiReady(request)), 'API not reachable on :4010');
  owner = await gdsOwner(request, 'm7carry');
  test.skip(!(await gdsReady(request, owner)), 'GDS operations (M7) not served');
  oud = await product(request, owner, { name: 'Parfum Oud 100 ml', price: 4500, cost: 2400, stock: 10 });
  low = await product(request, owner, { name: 'Sac cuir camel', price: 5000, cost: 2500, stock: 1, minStock: 5 });
  const sup = await supplier(request, owner, 'Belkacem Import');
  const p = await receiveAll(request, owner, await purchase(request, owner, { supplierId: sup.id, lines: [{ productId: oud.id, quantity: 6, unitCost: 2400 }] }));
  purchaseId = p.id;
});

test('M2 carry-over — /movements: KPI tiles follow the filters, the purchase reference opens the purchase', async ({ page }) => {
  await signIn(page, owner);
  await open(page, `/fr/movements?productId=${oud.id}`, () => page.getByTestId('movement-kpis').locator('[data-kpi="in"]'));
  await expect(page.getByTestId('movement-kpis').locator('[data-kpi="in"]')).toContainText('+16'); // initial stock 10 + received 6
  await page.getByRole('link', { name: /#ACH-/ }).first().click();
  await expect(page).toHaveURL(new RegExp(`/fr/purchases/${purchaseId}`));
  await open(page, `/fr/movements?refType=purchase&refId=${purchaseId}`, () => page.getByTestId('movement-kpis').locator('[data-kpi="in"]'));
  await expect(page.getByTestId('movements-count')).toContainText('1 mouvement');
});

test('M2 carry-over — /stock: "ACHATS & FOURNISSEURS" block and "Réapprovisionner" → new purchase prefilled', async ({ page }) => {
  await signIn(page, owner);
  await open(page, '/fr/stock', () => page.getByTestId('purchasing-block'));
  await expect(page.getByTestId('purchasing-block').locator('[data-row="suppliers"]')).toContainText('1');
  await page.locator(`[data-product="${low.id}"]`).getByRole('button', { name: 'Réapprovisionner' }).click();
  await expect(page).toHaveURL(new RegExp(`/fr/purchases/new\\?productId=${low.id}`), { timeout: 30_000 });
  await expect(page.getByTestId('purchase-form').locator(`tr[data-line="${low.id}"]`)).toBeVisible({ timeout: 30_000 });
});

test('M2 carry-over — /products: the summary follows the filters (GET /products/stats)', async ({ page }) => {
  await signIn(page, owner);
  await open(page, '/fr/products', () => page.getByText(/produits?/).first());
  await open(page, '/fr/products?lowStock=1', () => page.getByText(/1 résultat/).first());
  // the value at cost is the one of the filtered product only (1 × 2 500), not of the whole catalogue
  await expect(page.getByText(/1 résultat · 1 en stock faible · valeur 2\s?500\s?DA au coût/)).toBeVisible();
});

test('GDS-09 — product expenses: per-unit expense with the margin preview, the margin block recomputed', async ({ page, request }) => {
  await signIn(page, owner);
  await open(page, `/fr/products/${oud.id}`, () => page.getByTestId('expenses-editor'));
  await page.getByTestId('expense-add').click();
  const dlg = page.getByTestId('expense-dialog');
  await dlg.getByLabel('Montant (DA)').fill('120');
  // 4 500 price, cost 2 400 ⇒ 46,7 % → 44,0 %
  await expect(dlg.getByTestId('expense-preview')).toContainText('46,7 % → 44,0 %');
  await page.getByRole('dialog').getByTestId('dialog-submit').click();
  await expect(page.getByTestId('expenses-list')).toContainText('Emballage');
  const p = await getJson<{ pricing: { expensesPerUnit: number; marginPct: number } }>(request, owner, `/products/${oud.id}`);
  expect(p.pricing.expensesPerUnit).toBe(120);
  await expect(page.getByTestId('pricing-margin')).toContainText('44');
});

test('M5 carry-over — /orders/import: CSV → preview with row errors → import → orders created', async ({ page }) => {
  await signIn(page, owner);
  await open(page, '/fr/orders/import', () => page.getByTestId('order-import-dropzone'));
  const csv = [
    'clientName,phone,wilaya,commune,address,items,note',
    `Amina Belkacem,${uniquePhone()},16,,Cité 200 logements Bab Ezzouar,${oud.sku}×2,`,
    `Yacine Mansouri,0123,16,,Rue Didouche Mourad Alger centre,${oud.sku}×1,`,
    `Sara Kaci,${uniquePhone()},19,,Cité 1000 logements Sétif,INCONNU-1×1,`,
  ].join('\n');
  await page.getByTestId('order-import-file').setInputFiles({ name: 'commandes.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });
  await expect(page.getByTestId('order-import-tiles').or(page.getByTestId('order-import-mapping'))).toBeVisible({ timeout: 60_000 });
  if (await page.getByTestId('order-import-mapping').isVisible()) await page.getByTestId('order-import-mapping-save').click();
  await expect(page.getByTestId('order-import-tiles')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('order-import-rows')).toContainText('SKU inconnu : INCONNU-1');
  await page.getByTestId('order-import-commit').click();
  await expect(page.getByTestId('order-import-done')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId('order-report-created')).toContainText('1');
  await page.getByRole('link', { name: 'Voir les commandes importées' }).click();
  await expect(page).toHaveURL(/\/fr\/orders\?source=import/, { timeout: 90_000 });
});

test('AT-ST-07 — simple stock mode: GDS screens explain the advanced mode, recommendations keep the simple subset', async ({ page, request }) => {
  const simple = await gdsOwner(request, 'm7simple');
  await setStockMode(request, simple, 'simple');
  await signIn(page, simple);
  for (const path of ['/fr/suppliers', '/fr/purchases', '/fr/sales', '/fr/cash', '/fr/inventory']) {
    await open(page, path, () => page.getByTestId('gds-stock-mode'));
    await expect(page.getByText('Disponible en mode avancé')).toBeVisible();
  }
  await open(page, '/fr/recommendations', () => page.getByTestId('reco-kpis'));
  await expect(page.getByText(/Mode simple : seulement Réapprovisionner/)).toBeVisible();
  await expect(page.locator('nav [data-view="cross"]')).toHaveCount(0);
});
