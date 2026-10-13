// M9 — order online payment (P2, D4) on the REAL API with the fake Chargily page (never a real payment).
// Figma "DLG — Orders, delivery & clients II": "Lien de paiement (P2)" and "Rembourser (P2)"; Settings › Espace de
// travail "Paiement en ligne" toggle (03 §20, PAY-02). AT-DLG-14 (créer / créé (copier) / payé / expiré / échec),
// AT-DLG-15 (amount ≤ paid, reason required, order → remboursée), PAY-02 / PAY-03.
import { expect as baseExpect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './support/a11y';
import { apiReady, type Account } from './support/m1';
import { signIn, toastOf } from './support/m4-agents';
import { getOrder, seedOrder, seedProduct, shopOwner, type SeedOrder } from './support/m5-orders';
import { billingReady, payOutcome } from './support/m9';

test.describe.configure({ mode: 'serial', timeout: 300_000 });
const expect = baseExpect.configure({ timeout: 20_000 });
test.use({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });

let owner: Account;
let productId: string;
let paidOrder: SeedOrder;
const linkDialog = (page: Page) => page.getByTestId('payment-link-dialog');
async function openOrder(page: Page, id: string) {
  await expect(async () => {
    await page.goto(`/fr/orders/${id}`, { timeout: 60_000 });
    await expect(page.getByTestId('payment-block')).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 120_000 });
}
/** Opens the dialog, creates a link and returns its URL once the worker made the checkout. */
async function createLink(page: Page): Promise<string> {
  await page.getByTestId('open-payment-link').click();
  await expect(linkDialog(page)).toBeVisible();
  await page.getByTestId('dialog-submit').click();
  await expect(linkDialog(page)).toHaveAttribute('data-status', 'pending', { timeout: 30_000 });
  return page.getByTestId('payment-link-url').inputValue();
}

test.beforeAll(async ({ request }) => {
  test.skip(!(await apiReady(request)), 'API not reachable on :4010');
  owner = await shopOwner(request, 'm9pay');
  test.skip(!(await billingReady(request, owner)), 'M9 billing endpoints not available');
  productId = (await seedProduct(request, owner, 'Parfum Oud', 4700, 30)).id;
});

test('PAY-02 — without the workspace toggle no link is offered; Settings › Espace de travail turns it on', async ({ page, request }) => {
  paidOrder = await seedOrder(request, owner, { productId });
  await signIn(page, owner);
  await openOrder(page, paidOrder.id);
  // the server descriptor greys "Lien de paiement" while online payment is off
  const link = page.getByTestId('open-payment-link');
  if (await link.count()) await expect(link).toBeDisabled();
  await page.goto('/fr/settings/workspace');
  const toggle = page.getByTestId('online-payment').getByRole('switch');
  await expect(toggle).toBeVisible({ timeout: 30_000 });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(toastOf(page, 'Paiement en ligne activé')).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
});

test('AT-DLG-14 — CRÉER → CRÉÉ (url, Copier, 15 min) → PAYÉ by the fake gateway: order paid; axe', async ({ page, request }) => {
  await signIn(page, owner);
  await openOrder(page, paidOrder.id);
  await page.getByTestId('open-payment-link').click();
  const d = linkDialog(page);
  await expect(d).toHaveAttribute('data-status', 'none');
  await expect(d).toContainText(/lien valable 15 min/);
  // a seeded order has no conversation: the link can only be copied
  await expect(d.getByTestId('payment-link-send')).toBeDisabled();
  await expectNoA11yViolations(page);
  await page.getByTestId('dialog-submit').click();
  await expect(d).toHaveAttribute('data-status', 'pending', { timeout: 30_000 });
  const url = await d.getByTestId('payment-link-url').inputValue();
  expect(url).toMatch(/\/dev-payments\//);
  await expect(d).toContainText('CRÉÉ');
  await expect(d).toContainText(/expire le/);
  await d.getByTestId('payment-link-copy').click();
  await expect(toastOf(page, 'Lien copié')).toBeVisible();
  // the customer pays (fake gateway): the dialog follows the link, the order becomes paid
  await payOutcome(request, owner, url, 'paid');
  await expect(d).toHaveAttribute('data-status', 'paid', { timeout: 30_000 });
  await expect(d).toContainText(/commande → payée/);
  await expect.poll(async () => (await getOrder(request, owner, paidOrder.id)).paymentStatus, { timeout: 30_000 }).toBe('paid');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('payment-link-summary')).toHaveAttribute('data-status', 'paid');
});

test('AT-DLG-15 — Rembourser: more than paid is refused inline, reason required; order → remboursée', async ({ page, request }) => {
  const before = await getOrder(request, owner, paidOrder.id);
  const paid = Number(before.amountPaid);
  await signIn(page, owner);
  await openOrder(page, paidOrder.id);
  await page.getByTestId('open-refund').click();
  const d = page.getByTestId('refund-dialog');
  await expect(d).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText(/payé en ligne/);
  await d.getByTestId('refund-amount').fill(String(paid + 1000));
  await page.getByTestId('dialog-submit').click();
  await expect(d).toContainText(/Le remboursement dépasse le montant payé/);
  await d.getByTestId('refund-amount').fill(String(paid));
  await d.getByTestId('refund-reason').selectOption('other');
  await page.getByTestId('dialog-submit').click();
  await expect(d).toContainText('Indiquez le motif (3 caractères au moins).');
  await d.getByLabel('PRÉCISEZ LE MOTIF *').fill('Colis abîmé à la livraison');
  await page.getByTestId('dialog-submit').click();
  await expect(toastOf(page, /Remboursement de .* enregistré/)).toBeVisible();
  await expect.poll(async () => (await getOrder(request, owner, paidOrder.id)).paymentStatus, { timeout: 30_000 }).toBe('refunded');
  await expect(page.getByTestId('payment-block')).toContainText('REMBOURSÉE');
});

test('AT-DLG-14 — EXPIRÉ and ÉCHEC offer "Générer un nouveau lien"', async ({ page, request }) => {
  const o = await seedOrder(request, owner, { productId });
  await signIn(page, owner);
  await openOrder(page, o.id);
  const first = await createLink(page);
  await payOutcome(request, owner, first, 'expired');
  await expect(linkDialog(page)).toHaveAttribute('data-status', 'expired', { timeout: 30_000 });
  await expect(linkDialog(page)).toContainText('Le lien a expiré sans paiement.');
  await expect(page.getByTestId('dialog-submit')).toHaveText('Générer un nouveau lien');
  await page.getByTestId('dialog-submit').click();
  await expect(linkDialog(page)).toHaveAttribute('data-status', 'pending', { timeout: 30_000 });
  const second = await linkDialog(page).getByTestId('payment-link-url').inputValue();
  expect(second).not.toBe(first);
  await payOutcome(request, owner, second, 'failed');
  await expect(linkDialog(page)).toHaveAttribute('data-status', 'failed', { timeout: 30_000 });
  await expect(linkDialog(page)).toContainText(/Paiement refusé/);
  expect((await getOrder(request, owner, o.id)).paymentStatus).not.toBe('paid');
});
