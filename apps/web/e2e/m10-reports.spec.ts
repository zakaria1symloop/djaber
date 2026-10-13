// M10 — ADM-11 abuse reports (Figma "ADM-11 — Platform admin — abuse reports & blocked words") against the real API:
// the moderator's platform blacklist reaches the merchant's blocked list as a locked PLATEFORME row (AT-SAFE-03, admin
// part), the audited note is required, blocked words, filters in the URL, read-only roles.
import { expect, test } from '@playwright/test';
import { API, authHeaders, createAccount, loginHome, type Account } from './support/m1';
import { uniquePhone } from './support/m3-misc';
import { asAdmin, customerReport, loginAdmin, modAdmin, type ModAdmin } from './support/m10-mod';

test.describe.configure({ mode: 'serial' });

let moderator: ModAdmin;
let merchant: Account;

test.beforeAll(async ({ request }) => {
  test.setTimeout(180_000);
  moderator = await modAdmin(request, 'moderator', 'm10rep');
  const r = await request.get(`${API}/admin/reports/stats`, { headers: { Authorization: `Bearer ${moderator.accessToken}` } });
  expect(r.ok(), 'ADM-11 API (GET /admin/reports/stats) answers').toBeTruthy();
  merchant = await createAccount(request, { prefix: 'm10rep-shop', finishOnboarding: true });
});

test('AT-SAFE-03 platform blacklist from the treatment panel ⇒ PLATEFORME 🔒 row on the merchant blocked list', async ({ page, request, browser }) => {
  test.setTimeout(180_000);
  const phone = uniquePhone();
  const { report } = await customerReport(request, moderator, merchant, phone);
  await loginAdmin(page, moderator, `/fr/admin/reports?sheet=${report.id}`);

  const panel = page.getByTestId('report-panel');
  await expect(panel).toContainText('Traitement — Client signalé(e) par');
  await expect(panel).toContainText('EXTRAIT (lecture seule');

  // the audited note is required (≥ 10 chars): the error stays in the panel
  await panel.getByRole('radio', { name: /Liste noire plateforme/ }).check();
  await panel.getByTestId('report-note').fill('court');
  await panel.getByTestId('report-close').click();
  await expect(panel.getByRole('alert')).toContainText(/10 caractères/);

  await panel.getByTestId('report-note').fill('Insultes répétées confirmées par l’extrait.');
  await panel.getByTestId('report-close').click();
  await expect(page.getByText('Numéro ajouté à la liste noire plateforme')).toBeVisible();
  await expect(panel.getByTestId('report-decided')).toBeVisible();

  // merchant side: the platform row is locked (no Débloquer)
  const blocks = await (await request.get(`${API}/safety/blocks?pageSize=100`, { headers: authHeaders(merchant) })).json();
  expect((blocks.data as { source: string; phone: string | null }[]).some((b) => b.source === 'platform')).toBeTruthy();
  const ctx = await browser.newContext({ locale: 'fr-DZ', timezoneId: 'Africa/Algiers' });
  const m = await ctx.newPage();
  await loginHome(m, merchant);
  await m.goto('/fr/settings/security');
  const row = m.locator('li[data-source=platform]').first();
  await expect(row).toContainText('PLATEFORME');
  await expect(row.getByTestId('unblock')).toHaveCount(0);
  await ctx.close();

  // the blacklist is listed in "Règles automatiques"
  await page.getByTestId('safety-link-rules').click();
  await expect(page).toHaveURL(/panel=rules/);
  await expect(page.getByTestId('auto-rules').getByTestId('blacklist-row').first()).toBeVisible();
});

test('ADM-11 tabs and filters in the URL, blocked words, more info', async ({ page, request }) => {
  test.setTimeout(180_000);
  const { report } = await customerReport(request, moderator, merchant, uniquePhone());
  await loginAdmin(page, moderator, '/fr/admin/reports?tab=customers&severity=high');
  await expect(page.locator('[data-tab=customers]')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('Gravité : HAUTE', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retirer le filtre Gravité : HAUTE' }).click();
  await expect(page).not.toHaveURL(/severity=/);
  await page.goto(`/fr/admin/reports?sheet=${report.id}`);

  // "Demander plus d'infos" keeps the report open (status reviewing)
  const panel = page.getByTestId('report-panel');
  await panel.getByTestId('report-note').fill('Merci de préciser la date des insultes.');
  await panel.getByTestId('report-more-info').click();
  await expect(page.getByText("Demande d'informations envoyée")).toBeVisible();
  const after = await asAdmin<{ status: string }>(request, moderator, 'get', `/admin/reports/${report.id}`);
  expect(after.status).toBe('reviewing');

  // platform blocked words: add one, save, it is listed by the API
  const word = `arnaque${Date.now().toString(36)}`;
  await page.getByTestId('safety-link-words').click();
  const sheet = page.getByTestId('blocked-words');
  await sheet.getByTestId('word-input').fill(word);
  await sheet.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.getByTestId('words-save').click();
  await expect(page.getByText(/mots? enregistrés?/)).toBeVisible();
  const words = await asAdmin<{ words: { word: string }[] }>(request, moderator, 'get', '/admin/blocked-words');
  expect(words.words.map((w) => w.word)).toContain(word);
});

test('ADM-11 read-only for the finance role: no decision controls', async ({ page, request }) => {
  test.setTimeout(180_000);
  const finance = await modAdmin(request, 'finance', 'm10rep-fin');
  const { report } = await customerReport(request, moderator, merchant, uniquePhone());
  await loginAdmin(page, finance, `/fr/admin/reports?sheet=${report.id}`);
  const panel = page.getByTestId('report-panel');
  await expect(panel).toContainText('Lecture seule');
  await expect(panel.getByTestId('report-close')).toHaveCount(0);
});
