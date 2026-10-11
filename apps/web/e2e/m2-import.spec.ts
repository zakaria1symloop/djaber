// M2 — catalogue import wizard (CAT-06, FL-12): AT-CAT-05 UI side. Needs the API on :4010 and the worker (import jobs).
import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './support/a11y';
import { API, apiReady, authHeaders, createAccount, loginHome, type Account } from './support/m1';
import { catalogReady } from './support/m2';

test.describe.configure({ mode: 'serial' });
let account: Account;
const tag = Date.now().toString(36);
const EXISTING_SKU = `E2E-SAC-${tag}`;
const names = { ok1: `Foulard soie ${tag}`, ok2: `Tunique brodée ${tag}`, ok3: `Huile argan ${tag}`, noPrice: `Sans prix ${tag}`, taken: `Sac déjà là ${tag}`, dup: `Doublon ${tag}` };

/** 6 data rows: 3 valid, 3 in error (missing price · SKU already in the catalogue · SKU twice in the file). */
const CSV = [
  'Nom,SKU,Prix,Stock,Catégorie',
  `${names.ok1},E2E-FS-${tag},2400,12,Accessoires ${tag}`,
  `${names.noPrice},E2E-NP-${tag},,8,Accessoires ${tag}`,
  `${names.ok2},E2E-TB-${tag},5200,4,Vêtements ${tag}`,
  `${names.taken},${EXISTING_SKU},7200,3,Accessoires ${tag}`,
  `${names.ok3},E2E-HA-${tag},1900,0,Cosmétiques ${tag}`,
  `${names.dup},E2E-FS-${tag},1900,12,Cosmétiques ${tag}`,
].join('\n');

test.beforeAll(async ({ request }) => {
  test.skip(!(await apiReady(request)), 'API not reachable on :4010');
  account = await createAccount(request, { prefix: 'imp', finishOnboarding: true });
  test.skip(!(await catalogReady(request, account)), 'M2 catalogue API not available');
  const res = await request.post(`${API}/products`, { headers: authHeaders(account), data: { name: `Sac cuir camel ${tag}`, sku: EXISTING_SKU, price: 7200, stock: 2 } });
  expect(res.ok(), await res.text()).toBeTruthy();
});

test('AT-CAT-05 upload step: wrong type and too-large file are refused before any upload, axe', async ({ page }) => {
  await loginHome(page, account);
  await page.goto('/fr/products/import');
  await expect(page.getByRole('heading', { name: 'Importer des produits' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('import-dropzone')).toBeVisible();
  await expect(page.locator('ol[aria-label="Étapes de l’import"] [aria-current=step]')).toContainText('FICHIER');
  await expectNoA11yViolations(page);

  let uploads = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().endsWith('/products/import')) uploads++;
  });
  const input = page.getByTestId('import-file-input');
  await input.setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('not a table') });
  await expect(page.getByTestId('import-error')).toHaveAttribute('data-code', 'UPLOAD_TYPE_INVALID');
  await expect(page.getByTestId('import-error')).toContainText('Format non supporté.');

  await input.setInputFiles({ name: 'enorme.csv', mimeType: 'text/csv', buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 'a') });
  await expect(page.getByTestId('import-error')).toHaveAttribute('data-code', 'IMPORT_TOO_LARGE');
  await expect(page.getByTestId('import-error')).toContainText('Max 5 Mo et 2000 lignes.');
  expect(uploads).toBe(0);
  await expect(page).not.toHaveURL(/job=/);
});

test('AT-CAT-05 import with 3 bad rows: preview shows the row errors, commit writes only the valid rows', async ({ page }) => {
  await loginHome(page, account);
  await page.goto('/fr/products/import');
  await page.getByTestId('import-file-input').setInputFiles({ name: `catalogue-${tag}.csv`, mimeType: 'text/csv', buffer: Buffer.from(CSV, 'utf8') });

  // analysis job → preview (the job id is in the URL)
  await expect(page).toHaveURL(/job=/);
  await expect(page.getByTestId('import-commit')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('ol[aria-label="Étapes de l’import"] [aria-current=step]')).toContainText('APERÇU');
  await expect(page.getByTestId('import-file')).toContainText(`catalogue-${tag}.csv`);
  await expect(page.getByTestId('import-file')).toContainText('6 lignes');
  await expect(page.getByTestId('tile-valid')).toContainText('3');
  await expect(page.getByTestId('tile-invalid')).toContainText('3');

  // tab "Erreurs" (default): the 3 rows with their codes
  const table = page.getByRole('table', { name: 'Erreurs' });
  await expect(table.locator('tbody tr')).toHaveCount(3);
  await expect(table.locator('tbody tr', { hasText: names.noPrice }).locator('[data-code]')).toHaveAttribute('data-code', 'validation.price');
  await expect(table.locator('tbody tr', { hasText: names.noPrice })).toContainText('Prix de vente requis');
  await expect(table.locator('tbody tr', { hasText: names.taken }).locator('[data-code="PRODUCT_SKU_ALREADY_EXISTS"]')).toContainText('SKU déjà utilisé.');
  await expect(table.locator('tbody tr', { hasText: names.dup }).locator('[data-code="IMPORT_DUPLICATE_SKU_IN_FILE"]')).toContainText('SKU en double dans le fichier');

  // the tab is URL state
  await page.locator('[data-tab=all]').click();
  await expect(page).toHaveURL(/tab=all/);
  await expect(page.getByRole('table', { name: 'Toutes' }).locator('tbody tr')).toHaveCount(6);
  await page.locator('[data-tab=errors]').click();

  // a refresh resumes on the preview
  await page.reload();
  await expect(page.getByTestId('import-commit')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('import-commit')).toHaveText('Importer 3 produits');

  // nothing is written before the confirmation
  const before = await page.request.get(`${API}/products?q=${encodeURIComponent(tag)}`, { headers: authHeaders(account) });
  expect(((await before.json()) as { data: unknown[] }).data).toHaveLength(1);

  const commit = page.waitForRequest((r) => r.method() === 'POST' && /\/products\/import\/[^/]+\/commit$/.test(r.url()));
  await page.getByTestId('import-commit').click();
  expect((await commit).headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);

  const done = page.getByTestId('import-done');
  await expect(done).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/step=import/);
  await expect(done.getByTestId('report-created')).toContainText('3');
  await expect(done.getByTestId('report-updated')).toContainText('0');
  await expect(done.getByTestId('report-skipped')).toContainText('3');

  // the valid rows are in the catalogue, the rows in error are not
  await done.getByRole('link', { name: 'Voir les produits' }).click();
  await expect(page).toHaveURL(/\/fr\/products(\?|$)/, { timeout: 30_000 });
  for (const name of [names.ok1, names.ok2, names.ok3]) await expect(page.getByText(name).first()).toBeVisible({ timeout: 30_000 });
  const after = (await (await page.request.get(`${API}/products?q=${encodeURIComponent(tag)}&pageSize=50`, { headers: authHeaders(account) })).json()) as { data: { name: string }[] };
  const found = after.data.map((p) => p.name);
  expect(found).toEqual(expect.arrayContaining([names.ok1, names.ok2, names.ok3]));
  for (const name of [names.noPrice, names.taken, names.dup]) expect(found).not.toContain(name);
});
