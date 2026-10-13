// M9 — checkout return page `/settings/billing/return?ref=` on the REAL API with the fake Chargily page (FL-28).
// Figma "BIL-04 / BIL-03 — … Checkout return" + DLG "Retour de paiement (page)": VÉRIFICATION… (5 s × 12) → SUCCÈS ·
// EN ATTENTE (bank late; a late webhook still flips it to SUCCÈS) · ÉCHEC `PAYMENT_FAILED` · EXPIRÉ `PAYMENT_EXPIRED` ·
// unknown ref. AT-BIL-01 (pending then success when the webhook is late), AT-BIL-12 (EN ATTENTE after 12 polls, EXPIRÉ ⇒
// Recommencer), AT-DLG-66 (return page states).
import { expect as baseExpect, test, type APIRequestContext, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './support/a11y';
import { apiReady, type Account } from './support/m1';
import { signIn } from './support/m4-agents';
import { idem, realPost, setupShop } from './support/m4-real';
import { billingReady, chooseOnGateway, payOutcome, planBySlug, subscriptionOf } from './support/m9';

test.describe.configure({ mode: 'serial', timeout: 300_000 });
const expect = baseExpect.configure({ timeout: 20_000 });
test.use({ viewport: { width: 1440, height: 1000 } });

let owner: Account;
const status = (page: Page) => page.getByTestId('checkout-status');

/** A Starter checkout of the owner (nothing paid yet): the fake gateway URL. */
async function starterCheckout(request: APIRequestContext): Promise<string> {
  const plan = await planBySlug(request, owner, 'starter');
  const r = await realPost<{ checkoutUrl: string }>(request, owner, '/billing/checkout', { planId: plan.id, cycle: 'monthly' }, idem());
  return r.checkoutUrl;
}

test.beforeAll(async ({ request }) => {
  test.skip(!(await apiReady(request)), 'API not reachable on :4010');
  owner = (await setupShop(request, 'm9ret', { products: false, pages: false })).owner;
  test.skip(!(await billingReady(request, owner)), 'M9 billing endpoints not available');
});

test('AT-DLG-66 — unknown or missing ref ⇒ "Paiement introuvable" with a way back; full-width page (no settings sub-nav)', async ({ page }) => {
  await signIn(page, owner);
  await page.goto('/fr/settings/billing/return?ref=nope-0000');
  await expect(status(page)).toHaveAttribute('data-state', 'unknown', { timeout: 30_000 });
  await expect(page.getByText('Paiement introuvable')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Paramètres' })).toHaveCount(0);
  await page.goto('/fr/settings/billing/return');
  await expect(status(page)).toHaveAttribute('data-state', 'unknown', { timeout: 30_000 });
  await page.getByRole('link', { name: 'Voir la facturation' }).click();
  await expect(page).toHaveURL(/\/fr\/settings\/billing$/);
});

test('AT-DLG-66 — ÉCHEC: PAYMENT_FAILED with Réessayer / Autre moyen; nothing changed', async ({ page, request }) => {
  const url = await starterCheckout(request);
  await signIn(page, owner);
  await page.goto(url);
  await chooseOnGateway(page, 'failed');
  await expect(status(page)).toHaveAttribute('data-state', 'failed', { timeout: 60_000 });
  await expect(page.getByRole('heading', { name: 'Paiement refusé.' })).toBeVisible();
  await expect(page.getByTestId('return-manual')).toHaveAttribute('href', /\/help\/contact/);
  await expect(page.getByTestId('return-retry')).toHaveAttribute('href', /\/settings\/billing$/);
  await expectNoA11yViolations(page);
  expect((await subscriptionOf(request, owner)).status).toBe('trial');
});

test('AT-BIL-12 — EXPIRÉ: PAYMENT_EXPIRED (15 min session) ⇒ Recommencer back to the plans', async ({ page, request }) => {
  const url = await starterCheckout(request);
  await signIn(page, owner);
  await page.goto(url);
  await chooseOnGateway(page, 'expired');
  await expect(status(page)).toHaveAttribute('data-state', 'expired', { timeout: 60_000 });
  await expect(page.getByRole('heading', { name: 'Session de paiement expirée.' })).toBeVisible();
  await page.getByTestId('return-restart').click();
  await expect(page).toHaveURL(/\/fr\/settings\/billing$/);
  await expect(page.getByTestId('plan-cards')).toBeVisible({ timeout: 30_000 });
});

test('AT-BIL-01 / AT-BIL-12 — VÉRIFICATION… for 12 polls ⇒ EN ATTENTE; the late webhook then shows SUCCÈS', async ({ page, request }) => {
  test.setTimeout(240_000);
  const url = await starterCheckout(request);
  await signIn(page, owner);
  await page.goto(url);
  // "En attente": the checkout stays open at the gateway, the return page polls
  await chooseOnGateway(page, 'pending');
  await expect(page).toHaveURL(/\/fr\/settings\/billing\/return\?ref=/, { timeout: 30_000 });
  await expect(status(page)).toHaveAttribute('data-state', 'verifying', { timeout: 30_000 });
  await expect(page.getByText(/Confirmation du paiement auprès de Chargily \(CIB \/ Edahabia\)…/)).toBeVisible();
  await expect(page.getByText(/Vérification \d+ \/ 12/)).toBeVisible();
  // 12 answers × 5 s without a decision ⇒ EN ATTENTE
  await expect(status(page)).toHaveAttribute('data-state', 'pending', { timeout: 90_000 });
  await expect(page.getByText('La banque n’a pas encore confirmé')).toBeVisible();
  // the bank confirms later (late webhook): the page, still polling slowly, shows SUCCÈS
  await payOutcome(request, owner, url, 'paid');
  await expect(status(page)).toHaveAttribute('data-state', 'success', { timeout: 60_000 });
  await expect(page.getByText(/Starter actif jusqu’au/)).toBeVisible();
  await expect.poll(async () => (await subscriptionOf(request, owner)).plan.slug).toBe('starter');
});
