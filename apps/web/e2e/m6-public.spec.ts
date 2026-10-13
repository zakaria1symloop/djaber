// M6 — public parcel tracking `/s/[code]` (QR of the label; PublicLayout header; Figma "DLV-06 / ORD-09" QR target +
// "PUB — …" page chrome, "SAFE" report dialog). No session: a fresh browser context. Real API + fake courier driver.
import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './support/a11y';
import { apiReady, type Account } from './support/m1';
import { open, seedProduct, shopOwner } from './support/m5-orders';
import { confirmedOrder, deliveryReady, seedCourier, sendOrder, type Parcel } from './support/m6';

test.describe.configure({ mode: 'serial', timeout: 180_000 });

let owner: Account;
let parcel: Parcel;
let path: string;
let phone: string;

test.beforeAll(async ({ request }) => {
  test.setTimeout(300_000);
  test.skip(!(await apiReady(request)), 'API not reachable on :4010');
  owner = await shopOwner(request, 'm6pub');
  test.skip(!(await deliveryReady(request, owner)), 'delivery module (M6) not served');
  const p = await seedProduct(request, owner, 'Coffret Oud', 5200);
  const c = await seedCourier(request, owner, { provider: 'zrexpress' });
  const o = await confirmedOrder(request, owner, p.id, { name: 'Amina Belkacem' });
  phone = o.clientPhone;
  parcel = await sendOrder(request, owner, o.id, c.id);
  path = new URL(parcel.publicTrackingUrl).pathname.replace(/^\/(fr|ar|en)/, '');
});

test('AT-PUB-05 — /s/:code shows the mapped timeline only (no customer phone), header chrome, steps; axe', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'fr-DZ', timezoneId: 'Africa/Algiers' });
  const page = await ctx.newPage();
  await open(page, `/fr${path}`, () => page.getByTestId('tracking-public').and(page.locator('[data-state="sent"]')));
  await expect(page.getByRole('link', { name: 'Essai gratuit 14 j' })).toBeVisible();
  await expect(page.getByTestId('parcel-steps')).toBeVisible();
  await expect(page.getByTestId('tracking-timeline')).toBeVisible();
  await expect(page.getByTestId('tracking-public')).toContainText(parcel.trackingNumber!);
  const text = (await page.locator('main').innerText()).replace(/\s/g, '');
  expect(text).not.toContain(phone.slice(-8));
  await expectNoA11yViolations(page);
  await ctx.close();
});

test('AT-PUB-05 — "Signaler ce vendeur" sends an end-customer report; unknown code ⇒ "Colis introuvable"', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'fr-DZ', timezoneId: 'Africa/Algiers' });
  const page = await ctx.newPage();
  await open(page, `/fr${path}`, () => page.getByTestId('report-merchant'));
  await page.getByTestId('report-merchant').click();
  const d = page.getByTestId('report-dialog');
  await page.getByTestId('dialog-submit').click();
  await expect(d).toContainText('Champ requis');
  await d.getByRole('radio', { name: /Arnaque/ }).click();
  await page.locator('#rep-details').fill('Le colis ne correspond pas à la commande.');
  // M11: the captcha is required (dev provider `fake` = the "Je ne suis pas un robot" checkbox, token `fake-pass`)
  await page.getByTestId('dialog-submit').click();
  await expect(d.getByTestId('captcha')).toContainText('Cochez la case « Je ne suis pas un robot ».');
  await expect(page.locator('#rep-details')).toHaveValue('Le colis ne correspond pas à la commande.');
  await d.getByTestId('captcha-fake').check();
  await page.getByTestId('dialog-submit').click();
  await expect(page.getByTestId('report-sent')).toBeVisible({ timeout: 30_000 });

  await open(page, '/fr/s/inconnu-000000', () => page.getByTestId('tracking-public').and(page.locator('[data-state="not_found"]')));
  await expect(page.getByText('Colis introuvable')).toBeVisible();
  // RTL: the Arabic page mirrors, the tracking number stays LTR
  await open(page, `/ar${path}`, () => page.getByTestId('tracking-public').and(page.locator('[data-state="sent"]')));
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByTestId('tracking-public').locator('bdi[dir="ltr"]').filter({ hasText: parcel.trackingNumber! })).toBeVisible();
  await ctx.close();
});
