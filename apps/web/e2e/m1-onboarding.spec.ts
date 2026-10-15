// M1 — onboarding tunnel and stock mode (AT-ONB-01, AT-ONB-02). Needs the API on :4010.
import { expect, test } from '@playwright/test';
import { apiReady, createAccount, expectUrl, login, loginHome, type Account } from './support/m1';

test.describe.configure({ mode: 'serial' });
let account: Account;
test.beforeAll(async ({ request }) => {
  test.skip(!(await apiReady(request)), 'API not reachable on :4010');
  account = await createAccount(request, { prefix: 'onb', firstName: 'Lina' });
});

test('AT-ONB-01 closing the browser at step 3 resumes at step 3; every step is skippable; Ready shows done / skipped', async ({ browser }) => {
  // first visit: steps 1 and 2, then the browser is closed on step 3
  const first = await browser.newContext({ locale: 'fr-DZ' });
  const p1 = await first.newPage();
  await login(p1, account);
  await expectUrl(p1, '**/fr/onboarding/welcome');
  await expect(p1.getByRole('heading', { name: /Bienvenue, Lina/ })).toBeVisible();
  await expect(p1.getByRole('list', { name: 'Étapes de configuration' }).locator('[aria-current="step"]')).toHaveText('Bienvenue');
  await p1.getByRole('button', { name: 'Commencer' }).click();
  await expectUrl(p1, '**/fr/onboarding/stock-mode');
  await expect(p1.getByRole('radio', { name: /Simple/ })).toBeChecked();
  await p1.getByRole('radio', { name: /Avancé/ }).click();
  await p1.getByRole('button', { name: 'Continuer' }).click();
  await expectUrl(p1, '**/fr/onboarding/first-product');
  await expect(p1.getByRole('heading', { name: 'Ajoutez votre premier produit' })).toBeVisible();
  // a later step cannot be opened ahead of the progress
  await p1.goto('/fr/onboarding/ready');
  await expectUrl(p1, '**/fr/onboarding/first-product');
  await first.close();

  // next login (new browser context): resumes at step 3, also when another app page is asked
  const second = await browser.newContext({ locale: 'fr-DZ' });
  const p2 = await second.newPage();
  await login(p2, account);
  await expectUrl(p2, '**/fr/onboarding/first-product');
  await p2.goto('/fr/settings/profile');
  await expectUrl(p2, '**/fr/onboarding/first-product');
  const steps = p2.getByRole('list', { name: 'Étapes de configuration' });
  await expect(steps.locator('[data-state="done"]')).toHaveCount(2);
  await expect(steps.locator('[aria-current="step"]')).toHaveText('Produit');

  // "← Stock" goes back, "Plus tard" skips each remaining step
  await p2.getByRole('link', { name: 'Stock', exact: true }).click();
  await expectUrl(p2, '**/fr/onboarding/stock-mode');
  await expect(p2.getByRole('radio', { name: /Avancé/ })).toBeChecked();
  await p2.getByRole('button', { name: 'Continuer' }).click();
  await expectUrl(p2, '**/fr/onboarding/first-product');
  await p2.getByRole('button', { name: 'Plus tard' }).click();
  await expectUrl(p2, '**/fr/onboarding/agent');
  await expect(p2.getByRole('radio', { name: /Vendeur Pro/ })).toBeChecked();
  await p2.getByRole('button', { name: 'Plus tard' }).click();
  await expectUrl(p2, '**/fr/onboarding/connect');
  // step 5 is blocked while the e-mail is unverified (resend offered), "Plus tard" still works
  await expect(p2.getByRole('alert').filter({ hasText: 'Vérifiez votre e-mail pour connecter une page' })).toBeVisible();
  await expect(p2.getByRole('button', { name: 'Continuer avec Facebook' })).toBeDisabled();
  await p2.getByRole('button', { name: 'Plus tard' }).click();
  await expectUrl(p2, '**/fr/onboarding/ready');

  // Ready: stock mode done, the skipped steps are listed as not done
  await expect(p2.getByRole('heading', { name: /Tout est prêt/ })).toBeVisible();
  await expect(p2.locator('[data-step="stock"] [data-done="true"]')).toContainText('Mode stock : Avancé');
  await expect(p2.locator('[data-step="product"] [data-done="false"]')).toContainText('Aucun produit pour l’instant');
  await expect(p2.locator('[data-step="agent"] [data-done="false"]')).toBeVisible();
  await expect(p2.locator('[data-step="page"] [data-done="false"]')).toBeVisible();
  await expect(p2.locator('[data-step="sale"] [data-done="false"]')).toBeVisible();
  await p2.getByRole('link', { name: 'Aller à l’accueil' }).click();
  await expectUrl(p2, '**/fr/home');
  await expect(p2.getByTestId('checklist-count')).toHaveText('0 / 4');
  // the tunnel is over: Home stays Home after a reload
  await p2.reload();
  await expect(p2).toHaveURL(/\/fr\/home$/);
  await second.close();
});

test('AT-ONB-02 simple stock mode hides the advanced sidebar entries', async ({ page }) => {
  await loginHome(page, account);
  const sidebar = page.getByRole('complementary');
  // the workspace was set to "Avancé" during onboarding
  await expect(sidebar.getByRole('link', { name: 'Achats' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Mouvements' })).toBeVisible();

  await page.goto('/fr/settings/stock-mode');
  await page.getByRole('radio', { name: /Simple/ }).click();
  // advanced → simple is confirmed first (the GDS screens leave the menu)
  await expect(page.getByRole('radio', { name: /Simple/ })).not.toBeChecked();
  await page.getByRole('dialog').getByRole('button', { name: 'Passer en mode simple' }).click();
  await expect(page.getByRole('radio', { name: /Simple/ })).toBeChecked();
  for (const hidden of ['Mouvements', 'Fournisseurs', 'Achats', 'Ventes', 'Caisse', 'Inventaires']) {
    await expect(sidebar.getByRole('link', { name: hidden, exact: true })).toHaveCount(0);
  }
  // GDS-10 "MODE SIMPLE": Recommandations stays with its simple subset (03 LST-05, M7 contradictions-log); Rapports
  // stays with its 9 simple reports (12 §24, AT-RPT-01; M8 contradictions-log)
  for (const kept of ['Produits', 'Catégories', 'Recommandations', 'Rapports', 'Commandes', 'Clients', 'Livraison & suivi', 'Boîte de réception', 'Agents IA']) {
    await expect(sidebar.getByRole('link', { name: kept, exact: true })).toBeVisible();
  }
  // persisted on the workspace (not in the browser): still simple after a reload
  await page.reload();
  await expect(page.getByRole('radio', { name: /Simple/ })).toBeChecked();
  await expect(sidebar.getByRole('link', { name: 'Achats' })).toHaveCount(0);

  await page.getByRole('radio', { name: /Avancé/ }).click();
  await expect(sidebar.getByRole('link', { name: 'Achats' })).toBeVisible();
});
