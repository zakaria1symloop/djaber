// M3 — Settings › Sécurité, trust & safety part (SAFE — Trust & safety (merchant)): AT-SAFE-01 / AT-SAFE-03 UI side
// that lives in Settings — block a number, MANUEL row, unblock (Admin+), platform rows locked
// (CUSTOMER_BLOCKED_BY_PLATFORM), automatic rules and blocked words. Blocking / reporting from the conversation menu
// is covered by the inbox specs. Needs the API on :4010 with the M3 safety routes.
import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './support/a11y';
import { API, apiReady, authHeaders, createAccount, loginHome, type Account } from './support/m1';
import { blockRow, fulfil, safetyReady, uniquePhone } from './support/m3-misc';

test.describe.configure({ mode: 'serial' });
let account: Account;
const phone = uniquePhone();
const shown = `${phone.slice(0, 4)} ${phone.slice(4, 6)} ${phone.slice(6, 8)} ${phone.slice(8, 10)}`;

test.beforeAll(async ({ request }) => {
  test.skip(!(await apiReady(request)), 'API not reachable on :4010');
  account = await createAccount(request, { prefix: 'safe', finishOnboarding: true });
  test.skip(!(await safetyReady(request, account)), 'M3 safety API (GET /safety/blocks) not reachable');
});

test('SAFE-04 blocked customers: empty state, "+ Bloquer un numéro" adds a MANUEL row, search in the URL, axe', async ({ page }) => {
  await loginHome(page, account);
  await page.goto('/fr/settings/security');
  await expect(page.getByRole('heading', { name: 'Clients bloqués' })).toBeVisible();
  await expect(page.getByTestId('blocks-empty')).toHaveText('Aucun client bloqué.');

  await page.getByTestId('block-number').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Bloquer un numéro' })).toBeVisible();
  // the phone is required: the dialog stays open with its content
  await dialog.getByTestId('block-number-save').click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await dialog.locator('#block-phone').fill(phone);
  await dialog.locator('#block-number-reason').selectOption('spam');
  await dialog.locator('#block-number-note').fill('Spam répété');
  await dialog.getByTestId('block-number-save').click();
  await expect(dialog).toBeHidden();

  const row = page.getByTestId('blocks').locator('li', { hasText: shown });
  await expect(row).toHaveAttribute('data-source', 'manual');
  await expect(row).toContainText('MANUEL');
  await expect(row).toContainText('Spam');
  await expect(row.getByTestId('unblock')).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByRole('searchbox', { name: 'Rechercher' }).last().fill('zz-introuvable');
  await expect(page).toHaveURL(/blockQ=zz-introuvable/);
  await expect(page.getByRole('heading', { name: 'Aucun résultat' })).toBeVisible();
  await page.goto('/fr/settings/security?blockSource=manual');
  await expect(page.getByTestId('blocks').locator('li')).toHaveCount(1);
});

test('AT-SAFE-01 unblock (Admin+): confirmation dialog, the row disappears, the server list is empty', async ({ page, request }) => {
  await loginHome(page, account);
  await page.goto('/fr/settings/security');
  const row = page.getByTestId('blocks').locator('li', { hasText: shown });
  await row.getByTestId('unblock').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: `Débloquer ${shown} ?` })).toBeVisible();
  await dialog.getByRole('button', { name: 'Débloquer', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('blocks-empty')).toBeVisible();
  const res = await request.get(`${API}/safety/blocks`, { headers: authHeaders(account) });
  expect(((await res.json()) as { data: unknown[] }).data).toHaveLength(0);
});

test('AT-SAFE-03 platform rows are locked: PLATEFORME pill, no "Débloquer", tooltip CUSTOMER_BLOCKED_BY_PLATFORM', async ({ page }) => {
  // a platform blacklist row is created by a moderator (M10): served from a contract-shaped fixture here
  const rows = [blockRow({ name: 'Walid H.', phone: '0550112233', source: 'manual', reason: 'harassment', reportStatus: 'open' }), blockRow({ phone: '0770445566', source: 'platform', reason: 'spam' }), blockRow({ name: 'Fake Buyer', source: 'auto_rule', reason: 'uncollected' })];
  await page.route(/\/api\/v1\/safety\/blocks/, (r) => (r.request().method() === 'GET' ? fulfil(r, rows, { page: 1, pageSize: 25, total: 3 }) : r.fallback()));
  await loginHome(page, account);
  await page.goto('/fr/settings/security');
  const list = page.getByTestId('blocks');
  await expect(list.locator('li')).toHaveCount(3);
  await expect(list.locator('li[data-source=manual]')).toContainText('signalé à Djaber (en cours)');
  await expect(list.locator('li[data-source=manual]')).toContainText('Harcèlement');
  await expect(list.locator('li[data-source=auto_rule]')).toContainText('AUTO');
  const platform = list.locator('li[data-source=platform]');
  await expect(platform).toContainText('PLATEFORME');
  await expect(platform).toContainText('(sans nom)');
  await expect(platform.getByTestId('unblock')).toHaveCount(0);
  await platform.getByTestId('unblock-locked').hover();
  await expect(page.getByRole('tooltip')).toContainText('CUSTOMER_BLOCKED_BY_PLATFORM');
});

test('SAFE-05 automatic rules and blocked words are saved and survive a reload', async ({ page }) => {
  await loginHome(page, account);
  await page.goto('/fr/settings/security');
  const rules = page.getByTestId('safety-rules');
  // defaults of 04 §13: risk after 2 returns ON, auto-block OFF, handoff on risk ON
  await expect(rules.locator('[data-rule=riskAfterReturns]')).toBeChecked();
  await expect(rules.locator('[data-rule=autoBlockEnabled]')).not.toBeChecked();
  await expect(rules.locator('[data-rule=handoffOnRisk]')).toBeChecked();
  await expect(rules).toContainText('Bloquer automatiquement après 3 commandes non récupérées (notification, annulable)');
  // the threshold is kept while the rule is off; 0 is refused inline (the API answers 422), 1–50 is saved on blur
  const threshold = page.getByTestId('auto-block-threshold');
  await expect(threshold).toHaveValue('3');
  await threshold.fill('0');
  await expect(rules.getByRole('alert')).toContainText('Entre 1 et 50');
  await threshold.fill('4');
  await threshold.blur();
  await expect(rules).toContainText('Bloquer automatiquement après 4 commandes non récupérées');
  await expect(rules.locator('[data-rule=autoBlockEnabled]')).not.toBeChecked();
  // the rules are locked while the threshold is being saved
  await expect(rules.locator('[data-rule=autoBlockEnabled]')).toBeEnabled();
  // server-backed switch: the cache is updated on the next tick, so the state is asserted, not read back at once
  await rules.locator('[data-rule=autoBlockEnabled]').click();
  await expect(rules.locator('[data-rule=autoBlockEnabled]')).toBeChecked();
  await expect(page.getByText('Enregistré').first()).toBeVisible();

  const words = page.getByTestId('blocked-words');
  await page.getByRole('textbox', { name: 'Ajouter des mots' }).fill('avocat, Arnaque, AVOCAT');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(words.locator('li')).toHaveCount(2);
  await expect(words).toContainText('avocat');
  // the API stores the words folded to lower case
  await expect(words).toContainText(/arnaque/i);

  await page.reload();
  await expect(page.getByTestId('safety-rules').locator('[data-rule=autoBlockEnabled]')).toBeChecked();
  await expect(page.getByTestId('auto-block-threshold')).toHaveValue('4');
  await expect(page.getByTestId('blocked-words').locator('li')).toHaveCount(2);
  await page.getByRole('button', { name: /Retirer « arnaque »/i }).click();
  await expect(page.getByTestId('blocked-words').locator('li')).toHaveCount(1);
  await expect(page.getByTestId('safety-rules').locator('[data-rule=autoBlockEnabled]')).toBeEnabled();
  await page.getByTestId('safety-rules').locator('[data-rule=autoBlockEnabled]').click();
  await expect(page.getByTestId('safety-rules').locator('[data-rule=autoBlockEnabled]')).not.toBeChecked();
  await expect(page.getByTestId('auto-block-threshold')).toHaveValue('4');
});
