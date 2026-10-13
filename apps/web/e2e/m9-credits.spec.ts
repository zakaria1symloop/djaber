// M9 — /settings/credits purchases on the REAL API (fake Chargily page, fake store IAP — never a real payment).
// Figma "BIL-04 / BIL-03 — Credits page (ledger)", DLG "Calculateur de crédits", "Acheter un pack".
// AT-BIL-07 (ledger rows of the reservation and of the debit, calculator estimates per plan), AT-PCK-04 / AT-DLG-66
// (calculator 1 200 × 4, 15 %, 8 % ⇒ 5 988 ⇒ Pro + 1 pack), web pack purchase (PCK-01, FL-28 same return page),
// ledger CSV export (job), AT-PCK-02 (plan used up + pack ⇒ AI still answers: warning, not exhausted) and AT-PCK-03
// (store refund ⇒ negative balance, red banners) — the last two replace the `// mock:` answers of m4-credits.
import { expect as baseExpect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './support/a11y';
import { apiReady, type Account } from './support/m1';
import { signIn, toastOf } from './support/m4-agents';
import { activeAgent, conversationOf, creditsOf, inject, nextSender, realGet, setCredits, setupShop, waitAiMessages, type Shop } from './support/m4-real';
import { amount, billingReady, chooseOnGateway, devPack, devStoreRefund, invoicesOf } from './support/m9';

test.describe.configure({ mode: 'serial', timeout: 300_000 });
const expect = baseExpect.configure({ timeout: 20_000 });
test.use({ viewport: { width: 1440, height: 1000 } });

let shop: Shop;
let owner: Account;
type LedgerRow = { id: string; action: string; bucket: string; credits: number };
const pill = (page: Page) => page.getByTestId('credits-pill');
const shellBanner = (page: Page, id: string) => page.locator(`[data-shell-banner="${id}"]`);
async function openCredits(page: Page, query = '') {
  await expect(async () => {
    await page.goto(`/fr/settings/credits${query}`, { timeout: 60_000 });
    await expect(page.getByTestId('credits-tiles')).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 120_000 });
}

test.beforeAll(async ({ request }) => {
  test.skip(!(await apiReady(request)), 'API not reachable on :4010');
  shop = await setupShop(request, 'm9cred');
  owner = shop.owner;
  test.skip(!(await billingReady(request, owner)), 'M9 billing endpoints not available');
  await activeAgent(request, owner, { name: 'Vendeur crédits M9', channelId: shop.facebook.id });
});

test('AT-BIL-07 — the ledger shows the settled debit of an AI turn (text_reply −1) next to the trial grant; balance after each row', async ({ page, request }) => {
  const sender = nextSender();
  await inject(request, owner, { channelId: shop.facebook.id, sender, text: 'Bonjour' });
  await waitAiMessages(request, owner, (await conversationOf(request, owner, sender)).id);
  // the reservation of the run is settled in place (02 §6): once the reply is sent the row is the `text_reply` debit
  await expect
    .poll(async () => (await realGet<LedgerRow[]>(request, owner, '/credits/ledger?pageSize=50')).map((r) => r.action), { timeout: 30_000 })
    .toEqual(expect.arrayContaining(['text_reply', 'grant']));
  await signIn(page, owner);
  await openCredits(page);
  await expect(page.locator('[data-testid="ledger-row"][data-action="text_reply"]').first()).toContainText('−1');
  await expect(page.locator('[data-testid="ledger-row"][data-action="grant"]').first()).toContainText('+300');
});

test('AT-PCK-04 / AT-BIL-07 — calculator: 1 200 × 4, 15 %, 8 % ⇒ 5 988 credits ⇒ Pro + 1 pack, coverage per plan; inputs update the estimate; axe', async ({ page }) => {
  await signIn(page, owner);
  await openCredits(page);
  await page.getByTestId('open-calculator').click();
  const d = page.getByTestId('calculator-dialog');
  await expect(d).toBeVisible();
  await expect(d.getByTestId('calc-result')).toHaveAttribute('data-credits', '5988', { timeout: 30_000 });
  await expect(d.getByTestId('calc-result')).toContainText(/4\s?800 × 1 \+ 180 × 5 \+ 96 × 3 = 5\s?988 crédits \/ mois/);
  await expect(d.getByTestId('calc-result')).toContainText(/→ Pro \(5\s?000\) \+ 1 × pack/);
  await expect(d.getByTestId('calc-plan')).toHaveCount(3);
  await expect(d.locator('[data-testid="calc-plan"][data-plan="pro"]')).toContainText(/manque/);
  await expectNoA11yViolations(page);
  // 100 conversations ⇒ 400 + 75 + 24 = 499 ⇒ Starter covers it
  await d.getByTestId('calc-conversations').fill('100');
  await expect(d.getByTestId('calc-result')).toHaveAttribute('data-credits', '499');
  await expect(d.getByTestId('calc-result')).toContainText(/→ Starter \(1\s?500\)/, { timeout: 30_000 });
  await expect(d.locator('[data-testid="calc-plan"][data-plan="starter"]')).toContainText('couvert');
  // "Voir les packs" opens the purchase
  await page.getByTestId('calc-see-packs').click();
  await expect(page.getByTestId('buy-pack-dialog')).toBeVisible();
  await expect(page).toHaveURL(/buy=1/);
});

test('PCK-01 — buy a pack on the web: dialog, Chargily checkout (fake page), same return page, +credits in the packs tile and the ledger, invoice', async ({ page, request }) => {
  await signIn(page, owner);
  await openCredits(page, '?buy=1');
  const d = page.getByTestId('buy-pack-dialog');
  await expect(d.getByTestId('pack-option')).toHaveCount(3, { timeout: 30_000 });
  await d.locator('[data-testid="pack-option"][data-pack="pack-500"]').click();
  await expect(d.locator('[data-testid="pack-option"][data-pack="pack-500"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('pack-pay')).toHaveText(/Payer 450 DA \(CIB \/ Edahabia\)/);
  await page.getByTestId('pack-pay').click();
  await chooseOnGateway(page, 'paid');
  await expect(page).toHaveURL(/\/fr\/settings\/billing\/return\?ref=/, { timeout: 30_000 });
  await expect(page.getByTestId('checkout-status')).toHaveAttribute('data-state', 'success', { timeout: 60_000 });
  await expect(page.getByText(/500 crédits ajoutés à votre solde/)).toBeVisible();
  await page.getByTestId('return-back').click();
  await expect(page).toHaveURL(/\/fr\/settings\/credits$/);
  await expect(page.getByTestId('tile-packs')).toContainText('500');
  await expect(page.locator('[data-testid="ledger-row"][data-action="pack_purchase"]').first()).toContainText('+500');
  expect((await creditsOf(request, owner)).packs.remaining).toBe(500);
  expect((await invoicesOf(request, owner)).some((i) => i.kind === 'credit_pack' && i.status === 'paid' && i.amount === 450)).toBe(true);
});

test('BIL-04 — "Exporter CSV" starts the ledger export job with the filters of the URL and offers the file', async ({ page }) => {
  await signIn(page, owner);
  await openCredits(page, '?bucket=pack');
  const exports: string[] = [];
  page.on('request', (r) => r.url().includes('/credits/ledger/export') && exports.push(r.url()));
  await page.getByTestId('ledger-export').click();
  await expect(toastOf(page, /Export (terminé|de l’historique)/)).toBeVisible();
  expect(exports[0]).toContain('bucket=pack');
  expect(exports[0]).toContain('format=csv');
  await expect(toastOf(page, /Export terminé/)).toBeVisible({ timeout: 60_000 });
});

test('AT-PCK-02 — plan credits used up with pack credits left: amber pill, credits80 banner, never "épuisés"', async ({ page, request }) => {
  // `/dev/ai/credits { balance }` sets the TOTAL (plan + packs) through a plan grant: total = packs ⇒ plan used up
  const packs = (await creditsOf(request, owner)).packs.remaining;
  const c = await setCredits(request, owner, packs);
  expect(c.plan.remaining).toBe(0);
  const now = await creditsOf(request, owner);
  expect(now.packs.remaining).toBeGreaterThan(0);
  expect(now.exhausted).toBe(false);
  await signIn(page, owner);
  await expect(pill(page)).toHaveAttribute('data-level', 'warning', { timeout: 60_000 });
  await expect(shellBanner(page, 'credits80')).toBeVisible();
  await expect(shellBanner(page, 'credits100')).toHaveCount(0);
});

test('AT-PCK-03 — store refund after spending pack credits ⇒ negative balance: red shell banner with "Acheter un pack", page banner, negative packs tile', async ({ page, request }) => {
  const s = await setupShop(request, 'm9neg');
  await activeAgent(request, s.owner, { name: 'Vendeur négatif', channelId: s.facebook.id });
  const purchase = await devPack(request, s.owner);
  // plan used up, the pack left (the dev balance is the total: plan + packs)
  await setCredits(request, s.owner, (await creditsOf(request, s.owner)).packs.remaining);
  // one AI turn with the plan used up: paid from the pack
  const sender = nextSender();
  await inject(request, s.owner, { channelId: s.facebook.id, sender, text: 'Bonjour' });
  await waitAiMessages(request, s.owner, (await conversationOf(request, s.owner, sender)).id);
  await devStoreRefund(request, s.owner, purchase.transactionId);
  await expect.poll(async () => (await creditsOf(request, s.owner)).negative, { timeout: 30_000 }).toBe(true);
  const c = await creditsOf(request, s.owner);
  // the API keeps `packs.remaining` at 0 and carries the debt in `total`
  expect(c.total).toBeLessThan(0);
  await signIn(page, s.owner);
  const banner = shellBanner(page, 'negativeCredits');
  await expect(banner).toHaveText(/Solde de crédits négatif \(remboursement store\) — l'IA est bloquée jusqu'à régularisation\./, { timeout: 60_000 });
  await banner.getByRole('button', { name: 'Acheter des crédits' }).click();
  await expect(page).toHaveURL(/\/fr\/settings\/credits\?buy=1$/);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('credits-negative')).toBeVisible();
  await expect(page.getByTestId('tile-packs')).toContainText(new RegExp(`[-−]${amount(Math.abs(c.total)).source}`));
  await expect(page.locator('[data-testid="ledger-row"][data-action="store_refund"]').first()).toBeVisible();
});
