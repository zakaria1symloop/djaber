// M10 — ADM-10 moderation queue (Figma "ADM-10 — Platform admin — moderation queue (products) + review panel") against
// the real API: reject needs a reason + message (AT-MOD-04), two moderators on one item (AT-MOD-06), URGENT after the SLA
// (AT-MOD-08 UI), failed pre-screen flag (AT-MOD-10), filters in the URL, read-only roles.
import { expect, test, type Browser } from '@playwright/test';
import { API, createAccount, loginHome, type Account } from './support/m1';
import { adminHeaders } from './support/m10-help';
import { asAdmin, asMerchant, breachSla, loginAdmin, modAdmin, moderationReady, pendingProduct, waitForItem, type ModAdmin } from './support/m10-mod';

test.describe.configure({ mode: 'serial' });

let moderator: ModAdmin;
let second: ModAdmin;
let merchant: Account;

test.beforeAll(async ({ request }) => {
  test.setTimeout(240_000);
  moderator = await modAdmin(request, 'moderator');
  expect(await moderationReady(request, moderator), 'ADM-10 API (GET /admin/moderation/stats) answers').toBeTruthy();
  merchant = await createAccount(request, { prefix: 'm10mod-shop', finishOnboarding: true });
});

const merchantPage = async (browser: Browser, path: string) => {
  const ctx = await browser.newContext({ locale: 'fr-DZ', timezoneId: 'Africa/Algiers' });
  const page = await ctx.newPage();
  await loginHome(page, merchant);
  await page.goto(path);
  return { page, close: () => ctx.close() };
};

test('AT-MOD-04 reject without message ⇒ MODERATION_REASON_REQUIRED inline; with reason ⇒ product hidden and the merchant sees the refusal', async ({ page, request, browser }) => {
  test.setTimeout(180_000);
  const { product, item, name } = await pendingProduct(request, moderator, merchant);
  await loginAdmin(page, moderator, `/fr/admin/moderation?sheet=${item.id}`);

  const panel = page.getByTestId('mod-panel');
  await expect(panel.getByRole('heading', { name })).toBeVisible();
  await expect(panel).toContainText('EN ATTENTE');
  await expect(page.getByTestId('mod-row').filter({ hasText: name })).toHaveAttribute('data-active', 'true');

  // no reason, no message → the API refuses, the error stays in the panel
  await panel.getByTestId('mod-reject').click();
  await expect(panel.getByTestId('mod-error')).toContainText('Motif et message au marchand obligatoires');

  // the typed message survives an error and is guarded on leave
  await panel.getByRole('radio', { name: 'Contrefaçon / marque protégée' }).check();
  await panel.getByTestId('mod-message').fill('Ce produit utilise une marque protégée. Republiez-le sans la marque.');
  await page.getByRole('link', { name: "Vue d'ensemble" }).first().click();
  await expect(page.getByRole('dialog', { name: 'Quitter sans enregistrer ?' })).toBeVisible();
  await page.getByRole('button', { name: 'Rester' }).click();
  await expect(panel.getByTestId('mod-message')).toHaveValue(/marque protégée/);

  await panel.getByTestId('mod-reject').click();
  await expect(page.getByText(`« ${name} » rejeté · marchand notifié`)).toBeVisible();
  const decided = await waitForItem(request, moderator, product.id, (i) => i.status === 'rejected');
  expect(decided.status).toBe('rejected');

  // merchant side: the product page shows the refusal and the moderator's message
  const m = await merchantPage(browser, `/fr/products/${product.id}`);
  await expect(m.page.getByText('Ce produit utilise une marque protégée', { exact: false }).first()).toBeVisible();
  await m.close();
});

test('AT-MOD-06 two moderators on one item ⇒ MODERATION_ITEM_ALREADY_DECIDED and the panel refreshes', async ({ page, request }) => {
  test.setTimeout(240_000);
  second = await modAdmin(request, 'moderator', 'm10mod2');
  const { product, item } = await pendingProduct(request, moderator, merchant);
  await loginAdmin(page, moderator, `/fr/admin/moderation?sheet=${item.id}`);
  const panel = page.getByTestId('mod-panel');
  await expect(panel.getByTestId('mod-approve')).toBeVisible();

  // this moderator prepares a refusal while the other one approves first
  await panel.getByRole('radio', { name: 'Image inappropriée' }).check();
  await panel.getByTestId('mod-message').fill('Image non conforme.');
  await asAdmin(request, second, 'post', `/admin/moderation/items/${item.id}/approve`, {});
  // "Rejeter" at once: the API refuses it (409) and the panel shows the notice; when the live refresh (WS
  // `moderation.updated`) already replaced the form, the same refusal is checked on the API
  const clicked = await panel.getByTestId('mod-reject').click({ timeout: 1_500 }).then(
    () => true,
    () => false,
  );
  if (clicked) await expect(panel.getByTestId('mod-conflict')).toContainText('Déjà traité par un autre modérateur');
  else {
    const r = await request.post(`${API}/admin/moderation/items/${item.id}/reject`, { headers: adminHeaders(moderator), data: { decision: 'inappropriate_image', merchantMessage: 'Image non conforme.' } });
    expect(r.status()).toBe(409);
    expect((await r.json()).error.code).toBe('MODERATION_ITEM_ALREADY_DECIDED');
  }
  await waitForItem(request, moderator, product.id, (i) => i.status === 'approved');
  await expect(panel.getByTestId('mod-decided')).toBeVisible();
  await expect(panel).toContainText('VALIDÉ');
});

test('AT-MOD-08 an item past its SLA shows URGENT and sits in the Urgents tab', async ({ page, request }) => {
  test.setTimeout(180_000);
  const { item, name } = await pendingProduct(request, moderator, merchant);
  await breachSla(item.id);
  await loginAdmin(page, moderator, '/fr/admin/moderation?tab=urgent');
  await expect(page.locator('[data-tab=urgent]')).toHaveAttribute('aria-current', 'page');
  const row = page.getByTestId('mod-row').filter({ hasText: name });
  await expect(row).toBeVisible();
  await expect(row).toContainText('URGENT');
});

test('AT-MOD-10 a failed pre-screen leaves the item pending without score, flagged "pré-filtrage indisponible"', async ({ page, request }) => {
  test.setTimeout(180_000);
  const name = `Lampe prescreen-fail ${Date.now().toString(36)}`;
  const product = await asMerchant<{ id: string }>(request, merchant, 'post', '/products', { name, price: 2500, stock: 3 });
  const item = await waitForItem(request, moderator, product.id, (i) => i.status === 'pending' && i.aiScore === null);
  await loginAdmin(page, moderator, `/fr/admin/moderation?sheet=${item.id}`);
  const row = page.getByTestId('mod-row').filter({ hasText: name });
  await expect(row).toContainText('pré-filtrage indisponible');
  await expect(row).toContainText('—');
  await expect(page.getByTestId('mod-panel')).toContainText('pré-filtrage indisponible');
});

test('ADM-10 filters live in the URL; Mots & catégories interdits; read-only for the support role', async ({ page, request }) => {
  test.setTimeout(240_000);
  await loginAdmin(page, moderator, '/fr/admin/moderation?tab=urgent&trustLevel=standard&waitingOver=120');
  await expect(page.locator('[data-tab=urgent]')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('Confiance marchand : STANDARD', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Confiance marchand/ }).first().click();
  await page.getByRole('checkbox', { name: 'TRUSTED' }).click();
  await expect(page).toHaveURL(/trustLevel=standard%2Ctrusted|trustLevel=standard,trusted/);
  await page.keyboard.press('Escape');

  // header sheet with the platform lists (?panel=rules)
  await page.getByTestId('mod-link-lists').click();
  await expect(page).toHaveURL(/panel=rules/);
  const sheet = page.getByTestId('mod-rules');
  await sheet.getByRole('tab', { name: 'Marques protégées' }).click();
  await expect(sheet.getByTestId('mod-rule').first()).toBeVisible();
  await page.keyboard.press('Escape');

  // support: reads the queue, cannot decide
  const support = await modAdmin(request, 'support', 'm10mod-sup');
  const { item } = await pendingProduct(request, moderator, merchant);
  await page.context().clearCookies();
  await loginAdmin(page, support, `/fr/admin/moderation?sheet=${item.id}`);
  const panel = page.getByTestId('mod-panel');
  await expect(panel.getByTestId('mod-readonly')).toBeVisible();
  await expect(panel.getByTestId('mod-approve')).toHaveCount(0);
  await expect(page.getByTestId('mod-row-approve')).toHaveCount(0);
  await expect(page.getByTestId('mod-link-lists')).toBeVisible();
});
