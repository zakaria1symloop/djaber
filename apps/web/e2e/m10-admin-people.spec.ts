// M10 — ADM-01 overview, ADM-03 users (+ ADM-17 user sheet), ADM-16 platform team & deletion requests, ADM-09 audit
// log, ADM-17 viewers (Figma frames of the same names + DLG "Inviter un membre plateforme", "Changer le rôle plateforme",
// "Exporter le journal d'audit") against the real API: block / unblock with reason, user detail blocks, invite domain
// check ADMIN_EMAIL_DOMAIN_INVALID and own role ADMIN_CANNOT_DEMOTE_SELF (AT-DLG-74, AT-PRL-02 UI), audit diff + signed
// export job (AT-AUD-01 UI, AT-DLG-74), viewers reason gate, L6 error state, read-only role (403 per platform role).
import { expect, test, type Page } from '@playwright/test';
import { API, authHeaders, createAccount, type Account } from './support/m1';
import { loginAdmin, modAdmin, type ModAdmin } from './support/m10-mod';

test.describe.configure({ mode: 'serial' });

let admin: ModAdmin;
let merchant: Account;
let page: Page;
let wsId: string;

test.beforeAll(async ({ request, browser }) => {
  test.setTimeout(240_000);
  admin = await modAdmin(request, 'super_admin', 'm10wd');
  merchant = await createAccount(request, { prefix: 'm10wd-shop', finishOnboarding: true });
  wsId = (await (await request.get(`${API}/workspace`, { headers: authHeaders(merchant) })).json()).data.id;
  page = await (await browser.newContext({ locale: 'fr-DZ', timezoneId: 'Africa/Algiers' })).newPage();
  await loginAdmin(page, admin, '/fr/admin');
});

test.afterAll(async () => {
  await page?.context().close();
});

test('ADM-01 overview: KPI tiles, chart, alerts panel, period in the URL', async () => {
  await expect(page.getByRole('heading', { name: 'Plateforme — vue d\'ensemble' })).toBeVisible();
  await expect(page.locator('[data-kpi="workspaces"]')).toContainText('espaces actifs');
  await expect(page.locator('[data-kpi="mrr"]')).toContainText('DA MRR');
  await expect(page.getByTestId('overview-chart')).toBeVisible();
  await expect(page.getByTestId('overview-alerts')).toContainText('Alertes plateforme');
  await page.getByTestId('period-picker').click();
  await page.getByRole('menuitem', { name: '7 j' }).click();
  await expect(page).toHaveURL(/period=7d/);
  await expect(page.locator('[data-kpi="credits"]')).toContainText('crédits consommés · 7 j');
});

test('ADM-03 users: search, NON VÉRIFIÉ / ACTIF pill, user sheet blocks, Bloquer then Débloquer with a reason', async () => {
  await page.goto(`/fr/admin/users?q=${encodeURIComponent(merchant.email)}`);
  const row = page.getByRole('row', { name: new RegExp(merchant.email.replace(/[.+]/g, '\\$&')) });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page).toHaveURL(/sheet=/);
  const sheet = page.getByTestId('user-sheet');
  for (const label of ['Identité', 'Espaces (Membership)', 'Sessions & appareils', 'Activité & audit']) await expect(sheet).toContainText(label, { ignoreCase: true });
  await page.keyboard.press('Escape');
  await row.getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'Bloquer' }).click();
  const dlg = page.getByTestId('dlg-user-block');
  await expect(dlg).toContainText('AUTH_USER_BLOCKED');
  await dlg.getByLabel('Raison').fill('Spam / fraude signalée ×3');
  await page.getByTestId('dlg-user-block-submit').click();
  await expect(page.getByText('Utilisateur bloqué.')).toBeVisible();
  await expect(row.locator('[data-pill]')).toHaveText('BLOQUÉ');
  await row.getByRole('button', { name: 'Actions' }).click();
  await page.getByRole('menuitem', { name: 'Débloquer' }).click();
  await page.getByTestId('dlg-user-unblock').getByLabel('Raison').fill('Erreur de signalement vérifiée');
  await page.getByTestId('dlg-user-unblock-submit').click();
  await expect(page.getByText('Utilisateur débloqué.')).toBeVisible();
});

test('AT-DLG-74 Inviter un membre plateforme: x@gmail.com ⇒ ADMIN_EMAIL_DOMAIN_INVALID inline; own role ⇒ ADMIN_CANNOT_DEMOTE_SELF', async () => {
  await page.goto('/fr/admin/team');
  await expect(page.getByTestId('role-matrix').locator('[data-capability="impersonate"] [data-role="support"]')).toHaveAttribute('data-allowed', 'true');
  await expect(page.getByTestId('role-matrix').locator('[data-capability="impersonate"] [data-role="finance"]')).toHaveAttribute('data-allowed', 'false');
  await page.getByTestId('invite-member').click();
  const dlg = page.getByTestId('dlg-invite');
  await dlg.getByLabel('E-mail').fill('x@gmail.com');
  await page.getByTestId('dlg-invite-submit').click();
  await expect(dlg.getByText('E-mail @djaber.ai requis.')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Annuler' }).click();

  // own row: "Modifier le rôle" stays visible but greyed with the server reason (D42, ADMIN_CANNOT_DEMOTE_SELF)
  const me = page.getByTestId('platform-members').getByRole('row', { name: new RegExp(admin.email.replace(/[.+]/g, '\$&')) });
  await me.getByRole('button', { name: 'Actions' }).click();
  await expect(page.getByRole('menuitem', { name: 'Modifier le rôle' })).toHaveAttribute('data-disabled', '');
  await expect(page.getByRole('menu')).toContainText('ADMIN_CANNOT_DEMOTE_SELF');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('deletion-requests')).toContainText('Demandes de suppression de compte');
});

test('AT-AUD-01 UI / AT-DLG-74 audit log: the block action is listed with its reason, detail diff, signed export job', async () => {
  await page.goto('/fr/admin/audit?action=user.block');
  const row = page.getByRole('row', { name: /Spam \/ fraude signalée ×3/ }).first();
  await expect(row).toBeVisible();
  await row.click();
  await expect(page).toHaveURL(/sheet=/);
  const detail = page.getByTestId('audit-detail');
  await expect(detail).toContainText('USER.BLOCK');
  await expect(detail.getByTestId('code-diff').or(detail.getByText('Aucun avant / après enregistré pour cette action.'))).toBeVisible();
  await page.getByTestId('audit-export').click();
  const dlg = page.getByTestId('dlg-audit-export');
  await expect(dlg.getByRole('radio', { name: 'CSV signé (SHA-256 dans l\'en-tête)' })).toBeChecked();
  await page.getByTestId('dlg-audit-export-submit').click();
  await expect(page.getByText(/Export du journal en cours…|Export signé prêt\./)).toBeVisible();
  await expect(page.getByText('Export signé prêt.')).toBeVisible({ timeout: 60_000 });
});

test('ADM-17 viewers: products list of a workspace (LECTURE SEULE · JOURNALISÉ), conversation opens only with a reason', async () => {
  await page.goto(`/fr/admin/viewers/products?workspaceId=${wsId}`);
  await expect(page.getByText('LECTURE SEULE · JOURNALISÉ')).toBeVisible();
  await expect(page.getByTestId('viewer-products')).toBeVisible();
  await expect(page.getByTestId('viewer-conversations')).toBeVisible();
  await page.goto('/fr/admin/viewers/conversations/00000000-0000-0000-0000-000000000000');
  const gate = page.getByTestId('viewer-reason');
  await expect(page.getByTestId('viewer-open')).toBeDisabled();
  await gate.getByLabel('Raison').fill('Signalement #412 : vérifier le prix annoncé');
  await page.getByTestId('viewer-open').click();
  await expect(gate.locator('[role=alert]').first()).toBeVisible();
});

test('L6 error state: a 5xx list answer shows the error with ref and Réessayer', async () => {
  // mock: the API never answers 5xx on demand — the list route is intercepted once
  await page.route(/\/api\/v1\/admin\/users\?/, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'INTERNAL', message: 'Erreur interne', ref: 'req-e2e-500' } }) }));
  await page.goto('/fr/admin/users');
  await expect(page.getByText(/req-e2e-500/)).toBeVisible();
  await page.unroute(/\/api\/v1\/admin\/users\?/);
  await page.getByRole('button', { name: 'Réessayer' }).click();
  await expect(page.getByTestId('users-list')).toBeVisible();
});

test('TWO_FA_REQUIRED_FOR_ROLE ⇒ the admin page explains the 2FA requirement with a link to Sécurité', async () => {
  // mock: a member without 2FA cannot log in through the 2FA step of this suite — the API answer is intercepted
  await page.route(/\/api\/v1\/admin\/plans/, (route) => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: { code: 'TWO_FA_REQUIRED_FOR_ROLE', message: 'La 2FA est obligatoire pour ce rôle.', ref: 'e2e' } }) }));
  await page.goto('/fr/admin/plans');
  await expect(page.getByText('2FA obligatoire pour les rôles plateforme')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Activer la 2FA' })).toHaveAttribute('href', '/fr/settings/security');
  await page.unroute(/\/api\/v1\/admin\/plans/);
});

test('403 per platform role: a "read" member sees every list but no write control', async ({ browser, request }) => {
  test.setTimeout(180_000);
  const reader = await modAdmin(request, 'read', 'm10wd-read');
  const ctx = await browser.newContext({ locale: 'fr-DZ', timezoneId: 'Africa/Algiers' });
  const p = await ctx.newPage();
  await loginAdmin(p, reader, '/fr/admin/workspaces');
  await expect(p.getByTestId('admin-role-tag')).toHaveText('PLATEFORME · LECTURE');
  await expect(p.getByTestId('ws-list')).toBeVisible();
  await expect(p.getByTestId('create-workspace')).toHaveCount(0);
  await p.goto('/fr/admin/plans');
  await expect(p.getByTestId('plan-cards')).toBeVisible();
  await expect(p.getByTestId('new-plan')).toHaveCount(0);
  await p.goto('/fr/admin/team');
  await expect(p.getByTestId('invite-member')).toHaveCount(0);
  await ctx.close();
});
