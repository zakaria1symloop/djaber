// M9 — Plan & facturation on the REAL API (PAYMENT_DRIVER=fake: the fake Chargily page of the API, never a real payment).
// Figma "BIL-01 — Settings — Plan & billing", "DLG — Settings & billing" (Changer de plan, Résilier), "BIL-04 / BIL-03 —
// … Invoices · Checkout return", "GLOBAL — Plan expired — free limits applied (Channels)".
// AT-BIL-06 (plans, limits, checkout redirect, invoices, cancel at period end), AT-DLG-65 (change plan: prorata line,
// downgrade lists what pauses, promo errors inline), AT-BIL-10 (dunning banner → Payer maintenant), AT-BIL-02 (expiry ⇒
// free limits, pages / agents paused by plan, banner "Plan expiré"), permissions (Admin read-only, Operator 403).
import { expect as baseExpect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './support/a11y';
import { apiReady, type Account } from './support/m1';
import { signIn, toastOf } from './support/m4-agents';
import { activeAgent, setupShop, type Shop } from './support/m4-real';
import { amount, billingClock, billingReady, chooseOnGateway, devSubscription, invoicesOf, inviteMember, subscriptionOf } from './support/m9';

test.describe.configure({ mode: 'serial', timeout: 300_000 });
const expect = baseExpect.configure({ timeout: 20_000 });
test.use({ viewport: { width: 1440, height: 1000 } });

let shop: Shop;
let owner: Account;
const card = (page: Page, slug: string) => page.locator(`[data-testid="plan-card"][data-plan="${slug}"]`);
const cta = (page: Page, slug: string) => page.getByTestId(`plan-cta-${slug}`);
const dialog = (page: Page) => page.getByRole('dialog');
const shellBanner = (page: Page, id: string) => page.locator(`[data-shell-banner="${id}"]`);

async function openBilling(page: Page, query = '') {
  await expect(async () => {
    await page.goto(`/fr/settings/billing${query}`, { timeout: 60_000 });
    await expect(page.getByTestId('plan-cards')).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 120_000 });
}

test.beforeAll(async ({ request }) => {
  test.skip(!(await apiReady(request)), 'API not reachable on :4010');
  shop = await setupShop(request, 'm9bil', { products: false });
  owner = shop.owner;
  test.skip(!(await billingReady(request, owner)), 'M9 billing endpoints not available');
  // three active agents: Starter allows 2 ⇒ the downgrade has something to pause
  await activeAgent(request, owner, { name: 'Vendeur Un', channelId: shop.facebook.id });
  await activeAgent(request, owner, { name: 'Vendeur Deux', channelId: shop.facebook2.id });
  await activeAgent(request, owner, { name: 'Vendeur Trois', channelId: shop.instagram.id });
});

test('AT-BIL-06 — trial: plan cards with the limits, usage, cycle in the URL, invoices empty; sub-nav; axe', async ({ page }) => {
  await signIn(page, owner);
  await page.goto('/fr/settings/profile');
  await expect(page.getByRole('link', { name: 'Plan & facturation' })).toBeVisible({ timeout: 30_000 });
  await openBilling(page);
  await expect(page.getByRole('heading', { name: 'Plan & facturation' })).toBeVisible();
  await expect(page.getByText(/Essai gratuit Pro · se termine le/)).toBeVisible();
  // three seed plans (D68) with their limits; the trial plan is marked ESSAI
  await expect(page.getByTestId('plan-card')).toHaveCount(3);
  await expect(card(page, 'pro')).toContainText('ESSAI');
  await expect(card(page, 'pro')).toContainText('5 pages');
  await expect(card(page, 'pro')).toContainText(/5\s?000 crédits \/ mois/);
  await expect(card(page, 'starter')).toContainText(amount(1900));
  await expect(card(page, 'starter')).toContainText('2 pages');
  await expect(card(page, 'free')).toContainText('1 page');
  await expect(cta(page, 'free')).toBeDisabled();
  await expect(cta(page, 'starter')).toHaveText('Passer à Starter');
  // usage tiles: the two Facebook pages (the linked Instagram account counts with its page) and the three agents
  await expect(page.getByTestId('usage-pages')).toContainText('2 / 5');
  await expect(page.getByTestId('usage-agents')).toContainText('3 / 5');
  // the cycle is URL state; yearly shows the monthly equivalent and the yearly bill
  await page.getByRole('radio', { name: /Annuel/ }).click();
  await expect(page).toHaveURL(/cycle=yearly/);
  await expect(card(page, 'pro')).toContainText(amount(4083));
  await expect(card(page, 'starter')).toContainText(amount(1583));
  await expect(card(page, 'starter')).toContainText(/facturé 19\s?000 DA \/ an/);
  await page.getByRole('radio', { name: 'Mensuel' }).click();
  await expect(page).not.toHaveURL(/cycle=/);
  await expect(page.getByTestId('invoices-card')).toContainText('Aucune facture');
  await expect(page.getByTestId('billing-cancel')).toHaveCount(0);
  await expectNoA11yViolations(page);
});

test('AT-DLG-65 — Changer de plan: amount now, promo error inline, checkout redirect to the fake gateway, return SUCCÈS, invoice PAYÉE', async ({ page, request }) => {
  await signIn(page, owner);
  await openBilling(page);
  await cta(page, 'pro').click();
  await expect(page).toHaveURL(/change=pro/);
  const d = dialog(page);
  await expect(d.getByTestId('change-plan-dialog')).toBeVisible();
  await expect(d.getByTestId('change-preview')).toContainText(/Aujourd’hui : 4\s?900 DA/);
  // a code that does not exist stays in the field with the catalogue message
  await d.getByTestId('promo-input').fill('NOPE-M9');
  await d.getByTestId('promo-apply').click();
  await expect(d.getByText('Code promo inconnu.')).toBeVisible();
  await expect(d.getByTestId('promo-input')).toHaveValue('NOPE-M9');
  await d.getByTestId('promo-input').fill('');
  await expect(d.getByTestId('change-submit')).toHaveText(/Payer 4\s?900 DA \(CIB \/ Edahabia\)/);
  await d.getByTestId('change-submit').click();
  // the browser leaves for the gateway page (fake Chargily), then comes back to the return page
  await chooseOnGateway(page, 'paid');
  await expect(page).toHaveURL(/\/fr\/settings\/billing\/return\?ref=/, { timeout: 30_000 });
  await expect(page.getByTestId('checkout-status')).toHaveAttribute('data-state', 'success', { timeout: 60_000 });
  await expect(page.getByText(/Pro actif jusqu’au/)).toBeVisible();
  await expect(page.getByText(/Facture /)).toBeVisible();
  await page.getByTestId('return-back').click();
  await expect(page).toHaveURL(/\/fr\/settings\/billing$/);
  await expect(card(page, 'pro')).toContainText('VOTRE PLAN');
  await expect(page.getByText(/Plan Pro · renouvellement le .* · paiement via Chargily/)).toBeVisible();
  const invoices = await invoicesOf(request, owner);
  expect(invoices.some((i) => i.status === 'paid' && i.kind === 'subscription')).toBe(true);
  await expect(page.locator('[data-testid="invoice-row"][data-status="paid"]').first()).toContainText('PAYÉE');
  await expect(page.locator('[data-testid="invoice-row"]').first()).toContainText(amount(4900));
});

test('AT-DLG-65 — downgrade Pro → Starter lists the page that will pause, booked for the period end; undo', async ({ page, request }) => {
  await signIn(page, owner);
  await openBilling(page);
  await cta(page, 'starter').click();
  const d = dialog(page);
  await expect(d.getByTestId('change-downgrade')).toContainText('RÉTROGRADER');
  // 3 agents, Starter allows 2 ⇒ the newest agent is named
  await expect(d.getByTestId('change-downgrade')).toContainText(/Vendeur Trois.* dépassent Starter : ils seront mis en pause/);
  await expect(d.getByTestId('change-submit')).toHaveText('Programmer le changement');
  await d.getByTestId('change-submit').click();
  await expect(toastOf(page, /Passage à Starter programmé le/)).toBeVisible();
  await expect(card(page, 'starter')).toContainText(/Passage à Starter programmé le/);
  expect((await subscriptionOf(request, owner)).nextPlan?.slug).toBe('starter');
  // the current card offers the undo
  await cta(page, 'pro').click();
  await expect(toastOf(page, 'Résiliation annulée : votre plan continue')).toBeVisible();
  await expect.poll(async () => (await subscriptionOf(request, owner)).nextPlan).toBeNull();
});

test('AT-BIL-06 — cancel at period end keeps the access, undo restores the renewal', async ({ page, request }) => {
  await signIn(page, owner);
  await openBilling(page);
  await expect(page.getByTestId('billing-cancel')).toContainText(/l’accès Pro reste actif jusqu’au/);
  await page.getByTestId('open-cancel').click();
  const d = dialog(page);
  await d.getByLabel('MOTIF (FACULTATIF)').fill('Pause saisonnière');
  await d.getByTestId('cancel-confirm').click();
  await expect(toastOf(page, /Résiliation programmée au/)).toBeVisible();
  await expect(page.getByTestId('billing-cancel')).toContainText(/Résiliation programmée : l’accès Pro reste actif/);
  await expect(card(page, 'pro')).toContainText(/Résiliation programmée : le plan gratuit s’applique le/);
  expect((await subscriptionOf(request, owner)).cancelAtPeriodEnd).toBe(true);
  // the plan is still Pro (access continues to the period end)
  await expect(card(page, 'pro')).toContainText('VOTRE PLAN');
  await page.getByTestId('billing-cancel').getByTestId('undo-cancel').click();
  await expect(toastOf(page, 'Résiliation annulée : votre plan continue')).toBeVisible();
  await expect.poll(async () => (await subscriptionOf(request, owner)).cancelAtPeriodEnd).toBe(false);
});

test('permissions — Admin reads the page with plan changes greyed (pay stays enabled); Operator gets 403 and no sub-nav item', async ({ page, request }) => {
  const admin = await inviteMember(request, owner, 'admin');
  const operator = await inviteMember(request, owner, 'operator', 'Omar');
  await signIn(page, admin);
  await openBilling(page);
  await expect(cta(page, 'starter')).toBeDisabled();
  await expect(cta(page, 'starter')).toHaveAttribute('title', 'Réservé au propriétaire de l’espace.');
  await expect(page.getByTestId('open-cancel')).toBeDisabled();
  await page.context().clearCookies();
  await signIn(page, operator);
  await page.goto('/fr/settings/profile');
  await expect(page.getByRole('link', { name: 'Profil' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('link', { name: 'Plan & facturation' })).toHaveCount(0);
  await page.goto('/fr/settings/billing');
  await expect(page.getByText('403')).toBeVisible({ timeout: 30_000 });
});

test('AT-BIL-10 — dunning d0: unpaid invoice, banner (billing + shell), Payer maintenant → fake gateway → paid, banner gone', async ({ page, request }) => {
  // J0 of R-J: renewal invoice unpaid, `status=dunning`, `dunningStage=d0` (dev lifecycle jump of the fake driver)
  await devSubscription(request, owner, 'dunning', { stage: 'd0' });
  await expect.poll(async () => (await subscriptionOf(request, owner)).status, { timeout: 30_000 }).toBe('dunning');
  const sub = await subscriptionOf(request, owner);
  expect(sub.unpaidInvoice).not.toBeNull();
  await signIn(page, owner);
  // the shell shows the dunning banner on every screen (plan expiré level)
  await page.goto('/fr/home');
  await expect(shellBanner(page, 'dunning')).toContainText(new RegExp(`Facture ${sub.unpaidInvoice!.number} impayée`), { timeout: 30_000 });
  await openBilling(page);
  await expect(page.locator('[data-banner="dunning"]')).toBeVisible();
  // the billing page shows it inline, not twice
  await expect(shellBanner(page, 'dunning')).toHaveCount(0);
  const unpaid = page.locator(`[data-testid="invoice-row"][data-number="${sub.unpaidInvoice!.number}"]`);
  await expect(unpaid).toContainText('IMPAYÉE');
  await unpaid.getByTestId('invoice-pay').click();
  await chooseOnGateway(page, 'paid');
  await expect(page.getByTestId('checkout-status')).toHaveAttribute('data-state', 'success', { timeout: 60_000 });
  await page.getByTestId('return-back').click();
  await expect(page.locator('[data-banner="dunning"]')).toHaveCount(0);
  await expect.poll(async () => (await subscriptionOf(request, owner)).status).toBe('active');
});

test('AT-BIL-02 — trial expiry: free limits, newest pages / agents paused by plan, "Plan expiré" banner, nothing read-only', async ({ page, request }) => {
  const s = await setupShop(request, 'm9exp', { products: false });
  await activeAgent(request, s.owner, { name: 'Vendeur A', channelId: s.facebook.id });
  await activeAgent(request, s.owner, { name: 'Vendeur B', channelId: s.facebook2.id });
  await billingClock(request, s.owner, 15);
  await expect.poll(async () => (await subscriptionOf(request, s.owner)).expiredFrom?.planName ?? null, { timeout: 30_000 }).toBe('Pro');
  const sub = await subscriptionOf(request, s.owner);
  // free plan: 1 page, 1 agent ⇒ the newest page and the newest agent are paused
  expect(sub.pausedResources.filter((r) => r.type === 'channel').length).toBe(1);
  expect(sub.pausedResources.filter((r) => r.type === 'agent').length).toBe(1);
  await signIn(page, s.owner);
  // GLOBAL "Plan expired — free limits applied (Channels)": shell banner + paused-by-plan cards
  await page.goto('/fr/channels');
  await expect(shellBanner(page, 'planExpired')).toContainText(/Plan expiré le .* limites du plan gratuit appliquées \(1 page, 1 agent\)/, { timeout: 30_000 });
  await expect(page.getByText('EN PAUSE (PLAN)').first()).toBeVisible();
  // the shell re-renders while the expiry events of the billing clock land: a click swallowed by that re-render is retried
  await baseExpect(async () => {
    if (!/\/fr\/settings\/billing$/.test(page.url())) await shellBanner(page, 'planExpired').getByRole('button', { name: 'Choisir un plan' }).click({ timeout: 3_000 });
    await baseExpect(page).toHaveURL(/\/fr\/settings\/billing$/, { timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
  await expect(page.locator('[data-banner="planExpired"]')).toBeVisible();
  await expect(page.getByTestId('paused-resources')).toContainText('EN PAUSE (PLAN)');
  await expect(card(page, 'free')).toContainText('VOTRE PLAN');
  // agents beyond the free limit: PAUSE (PLAN), no resume
  await page.goto('/fr/agents');
  await expect(page.getByText('PAUSE (PLAN)').first()).toBeVisible({ timeout: 30_000 });
});
