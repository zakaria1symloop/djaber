// M10 — public status page + maintenance (Figma "PUB — Public status page (status.djaber.ai)", 03 OPS-05/06, PFS-03):
// AT-OPS-03 status part (declared incident ⇒ public banner + EN COURS entry + help widget INCIDENT; resolved ⇒ RÉSOLU),
// subscription dialog, AT-PFS-04 banner part (scheduled maintenance window ⇒ shell banner), AT-ERR-01 MAINTENANCE_MODE
// (refused write ⇒ banner + inline error; refused read ⇒ full page retried). Real API on :4010.
import { expect, test, type APIRequestContext } from '@playwright/test';
import { expectNoA11yViolations } from './support/a11y';
import { API, apiReady, createAccount, loginHome, uniqueEmail, type Account } from './support/m1';
import { adminPost, adminPut, platformAdmin, statusReady, type Admin } from './support/m10-help';

test.describe.configure({ mode: 'serial' });
let owner: Account;
let admin: Admin;
const stamp = Date.now().toString(36);

test.beforeAll(async ({ request }) => {
  test.setTimeout(180_000);
  test.skip(!(await apiReady(request)), 'API not reachable on :4010');
  test.skip(!(await statusReady(request)), 'M10 public status API (GET /status) not reachable');
  owner = await createAccount(request, { prefix: 'status', finishOnboarding: true });
  admin = await platformAdmin(request, 'super_admin', 'status');
});

/** True when the public status carries the maintenance window starting at `from` (the API caches the setting 10 s). */
const windowIs = async (request: APIRequestContext, from: string) => {
  const m = ((await (await request.get(`${API}/status`)).json()) as { data: { maintenance: { scheduledFrom: string | null } | null } }).data.maintenance;
  return !!m?.scheduledFrom && Date.parse(m.scheduledFrom) === Date.parse(from);
};

test.afterAll(async ({ request }) => {
  // never leave a maintenance window behind on the shared dev API
  if (admin) await adminPut(request, admin, '/admin/maintenance', { enabled: false, scheduledFrom: null, scheduledTo: null, scope: 'all', reason: 'Fin du test e2e maintenance' }).catch(() => undefined);
});

test('PUB status: 8 components with 90-day uptime, history, FR · AR · EN, subscription dialog, axe', async ({ page }) => {
  await page.goto('/fr/status');
  await expect(page.getByTestId('status-components').getByTestId('status-component')).toHaveCount(8);
  await expect(page.getByRole('link', { name: 'Ouvrir Djaber' })).toBeVisible();
  await expect(page.getByTestId('status-banner')).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByTestId('status-subscribe-open').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: "S'abonner aux incidents" })).toBeVisible();
  await dialog.getByTestId('status-subscribe-submit').click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  const email = uniqueEmail('statussub');
  await dialog.getByTestId('status-subscribe-email').fill(email);
  await dialog.getByTestId('status-subscribe-submit').click();
  await expect(dialog.getByTestId('status-subscribed')).toContainText(email);
  await dialog.getByRole('button', { name: 'Fermer' }).last().click();
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'ar', exact: true }).click();
  await expect(page).toHaveURL(/\/ar\/status/);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('link', { name: 'فتح Djaber' })).toBeVisible();
});

test('AT-OPS-03 declared incident ⇒ public banner + EN COURS + help widget INCIDENT; resolved ⇒ RÉSOLU in the history', async ({ page, request }) => {
  const title = `Google Sheets : synchronisation en pause ${stamp}`;
  const incident = await adminPost<{ id: string }>(request, admin, '/admin/incidents', {
    title: { fr: title, ar: `Google Sheets متوقف ${stamp}`, en: `Google Sheets paused ${stamp}` },
    severity: 'minor',
    status: 'identified',
    components: ['google_sheets'],
    body: { fr: 'Quota Google plateforme atteint, aucune donnée perdue.' },
  });
  try {
    await page.goto('/fr/status');
    await expect(page.getByTestId('status-banner')).toHaveAttribute('data-state', 'incident');
    const entry = page.getByTestId('status-history').getByTestId('incident').filter({ hasText: title });
    await expect(entry).toHaveAttribute('data-open', 'true');
    await expect(entry).toContainText('EN COURS');
    await expect(page.getByTestId('status-component').filter({ hasText: 'Google Sheets' })).not.toHaveAttribute('data-state', 'operational');

    await loginHome(page, owner);
    await page.goto('/fr/help');
    await expect(page.getByTestId('overall-status')).not.toHaveAttribute('data-state', 'operational');
    await expect(page.getByTestId('service-status').getByTestId('service-row').filter({ hasText: 'Google Sheets' })).not.toContainText('OK');
  } finally {
    await adminPost(request, admin, `/admin/incidents/${incident.id}/resolve`, { postMortem: 'Quota relevé (e2e).' });
  }
  await page.goto('/fr/status');
  const resolved = page.getByTestId('status-history').getByTestId('incident').filter({ hasText: title });
  await expect(resolved).toHaveAttribute('data-open', 'false');
  await expect(resolved).toContainText('RÉSOLU');
});

test('AT-PFS-04 a scheduled maintenance window shows the maintenance banner on top of the shell', async ({ page, request }) => {
  const from = new Date(Date.now() + 2 * 3_600_000).toISOString();
  const to = new Date(Date.now() + 3 * 3_600_000).toISOString();
  await adminPut(request, admin, '/admin/maintenance', { enabled: true, scheduledFrom: from, scheduledTo: to, scope: 'all', reason: 'Fenêtre de test e2e programmée' });
  // the API caches the setting 10 s: wait until the public status carries the window
  await expect.poll(() => windowIs(request, from), { timeout: 20_000 }).toBe(true);
  await loginHome(page, owner);
  const banner = page.locator('[data-shell-banner=maintenance]');
  await expect(banner).toBeVisible();
  await expect(banner.getByTestId('maintenance-banner')).toHaveAttribute('data-state', 'scheduled');
  await expect(banner).toContainText('Maintenance programmée du');

  await adminPut(request, admin, '/admin/maintenance', { enabled: false, scheduledFrom: null, scheduledTo: null, scope: 'all', reason: 'Fin de la fenêtre de test e2e' });
  await expect.poll(() => windowIs(request, from), { timeout: 20_000 }).toBe(false);
  await page.reload();
  await expect(page.locator('[data-shell-banner=maintenance]')).toHaveCount(0);
});

test('AT-ERR-01 MAINTENANCE_MODE: refused write ⇒ banner + inline error (form kept); refused read ⇒ full page, retried', async ({ page }) => {
  const until = new Date(Date.now() + 3_600_000).toISOString();
  const refusal = { status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'MAINTENANCE_MODE', message: "Maintenance en cours jusqu'à 04:00 : lecture seule.", params: { until }, ref: 'e2e' } }) };
  await loginHome(page, owner);
  await page.goto('/fr/help/contact');
  // mock: an active maintenance window refuses every write of the shared dev API (the other specs, the team serving) —
  // the refusal is served for this one call only
  await page.route(`${API}/support/tickets`, (route) => (route.request().method() === 'POST' ? route.fulfill(refusal) : route.continue()));
  const form = page.getByTestId('contact-form');
  await form.getByTestId('ticket-message').fill('Les commandes ne remontent plus dans ma feuille depuis hier soir.');
  await form.getByTestId('ticket-submit').click();
  await expect(form.getByRole('alert')).toContainText('Maintenance en cours');
  await expect(form.getByTestId('ticket-message')).toHaveValue(/depuis hier soir/);
  await expect(page.locator('[data-shell-banner=maintenance]').getByTestId('maintenance-banner')).toHaveAttribute('data-state', 'active');
  await page.unroute(`${API}/support/tickets`);

  // mock: a window with scope `all` also refuses reads (same reason as above)
  await page.route(`${API}/support/tickets?*`, (route) => route.fulfill(refusal));
  await page.goto('/fr/help/tickets');
  await expect(page.getByTestId('maintenance-page')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Maintenance en cours' })).toBeVisible();
  await page.unroute(`${API}/support/tickets?*`);
  await page.getByTestId('maintenance-page').getByRole('button', { name: 'Réessayer' }).click();
  await expect(page.getByTestId('maintenance-page')).toHaveCount(0);
  await expect(page.getByTestId('tickets-list')).toBeVisible();
});

test('AT-PFS-05 legal re-acceptance: blocking interstitial, "Accepter" after the checkbox, app usable again', async ({ page }) => {
  // mock: publishing a major legal version on the shared dev API would force every account (team serving and every
  // other spec) through the re-acceptance; the pending list of this one user is served instead (accept is recorded here)
  let accepted: { key: string; version: number } | null = null;
  const pending = () => (accepted ? [] : [{ key: 'terms', version: 5, url: 'http://localhost:3010/legal/terms' }]);
  await page.route(`${API}/legal/pending`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: pending() }) }));
  // the shell starts from `MeDto.pendingLegal` (then `GET /legal/pending` after a 403 LEGAL_REACCEPT_REQUIRED)
  await page.route(`${API}/me`, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const res = await route.fetch();
    const body = (await res.json()) as { data: Record<string, unknown> };
    await route.fulfill({ response: res, json: { ...body, data: { ...body.data, pendingLegal: pending() } } });
  });
  await page.route(`${API}/legal/accept`, async (route) => {
    accepted = route.request().postDataJSON() as { key: string; version: number };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: null }) });
  });
  await loginHome(page, owner);
  // the boot of a fresh tab reads `GET /me` (the login answer carried the real, empty list)
  await page.reload();
  const dialog = page.getByRole('dialog', { name: 'Conditions mises à jour' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Conditions d’utilisation');
  await expect(dialog.getByRole('link', { name: 'Lire · v5' })).toBeVisible();
  // blocking: Esc does not close it and "Accepter" waits for the checkbox
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Accepter' })).toBeDisabled();
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Accepter' }).click();
  await expect(dialog).toBeHidden();
  expect(accepted).toEqual({ key: 'terms', version: 5 });
  await expect(page.getByRole('link', { name: 'Aide', exact: true })).toBeVisible();
  // the shell refetches `GET /me` after the acceptance: a call still inside the route handler when the test ends made
  // Playwright fail the test with "route.fetch: Test ended" (about one run in two)
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});
