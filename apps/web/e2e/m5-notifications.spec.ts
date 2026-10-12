// M5 — notification preferences (NTF-02, SET frame "Préférences de notifications (vous)") and the NTF-01 additions:
// "Préférences" button, Settings › Notifications sub-nav entry (every role), AT-NTF-04 UI side (e-mail off for
// `stock.low` is saved for the member and survives a reload; locked cells of the 03 §15 matrix), the browser sound on a
// new customer message (`PATCH /me/prefs { soundOnMessage }`), axe. On the REAL API.
import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './support/a11y';
import { apiReady, createAccount, expectUrl, loginHome, type Account } from './support/m1';
import { operatorOf } from './support/m4-inbox';
import { getMe, getPreferences, preferencesReady } from './support/m5-home';

test.describe.configure({ mode: 'serial', timeout: 180_000 });
let owner: Account;

test.beforeAll(async ({ request }) => {
  test.skip(!(await apiReady(request)), 'API not reachable on :4010');
  owner = await createAccount(request, { prefix: 'ntfpref', finishOnboarding: true });
  test.skip(!(await preferencesReady(request, owner)), 'M5 notification preferences API (GET /notification-preferences) not reachable');
});

test('NTF-01 "Préférences" opens Settings › Notifications; the table has the 11 families of the frame; axe', async ({ page }) => {
  await loginHome(page, owner);
  await page.goto('/fr/notifications');
  await page.getByTestId('notification-preferences-link').click();
  await expectUrl(page, '**/fr/settings/notifications');
  await expect(page).toHaveTitle('Notifications · Djaber.ai');
  await expect(page.getByRole('link', { name: 'Notifications', exact: true }).last()).toHaveAttribute('aria-current', 'page');
  const table = page.getByTestId('notification-preferences');
  // headers are uppercased by CSS (mono labels): the DOM text is "Événement", "In-app"…
  for (const head of ['ÉVÉNEMENT', 'IN-APP', 'E-MAIL', 'PUSH', 'SON']) await expect(table.locator('thead')).toContainText(head, { ignoreCase: true });
  await expect(table.locator('tbody tr')).toHaveCount(11);
  for (const row of ['Nouvelle commande IA', 'Stock faible / rupture', 'Tâches terminées (import, analyse, export)']) await expect(table).toContainText(row);
  // in-app is always on; cells the matrix never sends are a dash, cells always sent are locked on
  await expect(table.locator('[data-family=stock] td input[type=checkbox]')).toBeChecked();
  await expect(table.locator('[data-family=stock] [data-channel=push][data-locked=never]')).toContainText('—');
  await expect(table.locator('[data-family=parcels] [data-channel=email][data-locked=always] [role=switch]')).toBeDisabled();
  await expectNoA11yViolations(page);
});

test('AT-NTF-04 e-mail off for "Stock faible / rupture" is saved for the member and survives a reload', async ({ page, request }) => {
  await loginHome(page, owner);
  await page.goto('/fr/settings/notifications');
  const cell = page.locator('[data-family=stock] [data-channel=email] [role=switch]');
  await expect(cell).toHaveAttribute('aria-checked', 'true');
  const put = page.waitForRequest((r) => r.method() === 'PUT' && r.url().includes('/notification-preferences'));
  await cell.click();
  const body = (await put).postDataJSON() as { preferences: { type: string; email?: boolean }[] };
  expect(body.preferences).toEqual(expect.arrayContaining([{ type: 'stock_low', email: false }, { type: 'stock_out', email: false }]));
  await expect(page.getByText('Préférences enregistrées')).toBeVisible();
  await expect.poll(async () => (await getPreferences(request, owner)).find((p) => p.type === 'stock_low')?.email).toBe(false);
  await page.reload();
  await expect(page.locator('[data-family=stock] [data-channel=email] [role=switch]')).toHaveAttribute('aria-checked', 'false');
  // push stays as it was (only the e-mail column changed)
  const pref = (await getPreferences(request, owner)).find((p) => p.type === 'stock_low')!;
  expect(pref.inApp).toBe(true);
  // back on
  await page.locator('[data-family=stock] [data-channel=email] [role=switch]').click();
  await expect.poll(async () => (await getPreferences(request, owner)).find((p) => p.type === 'stock_low')?.email).toBe(true);
});

test('NTF-02 sound on a new customer message: PATCH /me/prefs { soundOnMessage }', async ({ page, request }) => {
  await loginHome(page, owner);
  await page.goto('/fr/settings/notifications');
  const toggle = page.getByTestId('sound-on-message').getByRole('switch');
  const before = (await getMe(request, owner)).prefs.soundOnMessage;
  await expect(toggle).toHaveAttribute('aria-checked', String(before));
  const patch = page.waitForRequest((r) => r.method() === 'PATCH' && r.url().includes('/me/prefs'));
  await toggle.click();
  expect((await patch).postDataJSON()).toEqual({ soundOnMessage: !before });
  await expect.poll(async () => (await getMe(request, owner)).prefs.soundOnMessage).toBe(!before);
  await page.reload();
  await expect(page.getByTestId('sound-on-message').getByRole('switch')).toHaveAttribute('aria-checked', String(!before));
});

test('Operator: Settings › Notifications is listed and editable (personal, `notifications.own`)', async ({ page, request }) => {
  const operator = await operatorOf(request, owner, 'ntfpref-operator');
  await loginHome(page, operator);
  await page.goto('/fr/settings/profile');
  await page.getByRole('link', { name: 'Notifications', exact: true }).last().click();
  await expectUrl(page, '**/fr/settings/notifications');
  await expect(page.getByTestId('notification-preferences').locator('tbody tr')).toHaveCount(11);
});
