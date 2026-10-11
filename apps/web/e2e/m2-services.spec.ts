// M2 — services list (CAT-11): empty state, AT-CAT-12 (only `trackStock=false` products), no stock action.
// Needs the API on :4010.
import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './support/a11y';
import { apiReady, createAccount, loginHome, type Account } from './support/m1';
import { catalogReady, seedProduct } from './support/m2';

test.describe.configure({ mode: 'serial' });
let account: Account;
const tag = Date.now().toString(36);
const SERVICE = `Retouche couture ${tag}`;
const SERVICE_2 = `Emballage cadeau ${tag}`;
const TRACKED = `Parfum Oud ${tag}`;
let serviceId = '';

test.beforeAll(async ({ request }) => {
  test.skip(!(await apiReady(request)), 'API not reachable on :4010');
  account = await createAccount(request, { prefix: 'srv', finishOnboarding: true });
  test.skip(!(await catalogReady(request, account)), 'M2 catalogue API not reachable');
});

test('CAT-11 empty state: text of the frame and the "+ Nouveau service" call to action, axe', async ({ page }) => {
  await loginHome(page, account);
  await page.goto('/fr/services');
  await expect(page.getByRole('heading', { name: 'Services', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Aucun service' })).toBeVisible();
  await expect(page.getByText('Un service se vend sans stock (retouche, emballage…).')).toBeVisible();
  await expect(page.getByTestId('new-service')).toHaveAttribute('href', /\/fr\/products\/new\?type=service$/);
  await expectNoA11yViolations(page);
});

test('AT-CAT-12 services list shows only trackStock=false products, without any stock action', async ({ page, request }) => {
  serviceId = (await seedProduct(request, account, { name: SERVICE, price: 800, trackStock: false })).id;
  await seedProduct(request, account, { name: SERVICE_2, price: 300, trackStock: false });
  await seedProduct(request, account, { name: TRACKED, price: 4500, stock: 12 });

  await loginHome(page, account);
  await page.goto('/fr/services');
  const table = page.getByRole('table', { name: 'Services' });
  await expect(table.locator('tbody tr')).toHaveCount(2);
  await expect(table.getByText(SERVICE)).toBeVisible();
  await expect(table.getByText(SERVICE_2)).toBeVisible();
  await expect(page.getByText(TRACKED)).toHaveCount(0);
  await expect(table.locator(`tr[data-row="${serviceId}"]`)).toContainText('800');
  await expectNoA11yViolations(page);

  // sort and search live in the URL
  await table.getByRole('button', { name: 'Trier par PRIX' }).click();
  await expect(page).toHaveURL(/sort=price/);
  await expect(table.locator('tbody tr').first()).toContainText(SERVICE_2);
  await page.getByRole('searchbox').fill('zzzz-introuvable');
  await expect(page).toHaveURL(/q=zzzz-introuvable/);
  await expect(page.getByRole('button', { name: 'Effacer les filtres' }).last()).toBeVisible();
  await page.goto('/fr/services');

  // row menu from the server descriptors: no stock adjustment, no movements
  await table.locator(`tr[data-row="${serviceId}"]`).getByRole('button', { name: 'Actions' }).click();
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem', { name: 'Modifier' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Ajuster le stock' })).toHaveCount(0);
  await expect(menu.getByRole('menuitem', { name: /Mouvements/ })).toHaveCount(0);
  await page.keyboard.press('Escape');

  // row click opens the product page: a service has no stock
  await table.getByText(SERVICE).click();
  await page.waitForURL(`**/fr/products/${serviceId}`);
  await expect(page.getByTestId('stock-tracking')).toContainText('service, pas de stock');
  await expect(page.getByTestId('adjust-stock')).toHaveCount(0);
});
