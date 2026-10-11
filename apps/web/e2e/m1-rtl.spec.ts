// M1 — AT-UX-02 (UI side): the shell in Arabic is right-to-left, translated, and the language switch keeps the path.
// The i18n key parity fr / ar / en is checked by `pnpm i18n:check`.
import { expect, test } from '@playwright/test';
import { apiReady, createAccount, expectUrl, login, type Account } from './support/m1';

test.describe.configure({ mode: 'serial' });
let account: Account;
test.beforeAll(async ({ request }) => {
  test.skip(!(await apiReady(request)), 'API not reachable on :4010');
  account = await createAccount(request, { prefix: 'rtl', finishOnboarding: true });
});

test('AT-UX-02 auth pages: Arabic is RTL and the FR · AR · EN switch keeps the page', async ({ page }) => {
  await page.goto('/fr/login?returnTo=%2Fsettings%2Fmembers');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await page.getByRole('group', { name: 'Langue' }).getByRole('button', { name: 'ar' }).click();
  await expect(page).toHaveURL(/\/ar\/login\?returnTo=%2Fsettings%2Fmembers$/);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
  // e-mail stays left-to-right inside the RTL form
  await expect(page.locator('#email')).toHaveAttribute('dir', 'ltr');
  await page.getByRole('group', { name: 'اللغة' }).getByRole('button', { name: 'en' }).click();
  await expect(page).toHaveURL(/\/en\/login\?returnTo=%2Fsettings%2Fmembers$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('AT-UX-02 merchant shell in Arabic: sidebar on the right, translated nav, numbers left-to-right', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, account, 'ar');
  await expectUrl(page, '**/ar/home');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

  const sidebar = page.getByRole('complementary');
  await expect(sidebar.getByRole('link', { name: 'الرئيسية', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(sidebar.getByRole('link', { name: 'صندوق الوارد' })).toBeVisible();
  const box = (await sidebar.boundingBox())!;
  expect(box.x).toBeGreaterThan(1440 / 2); // start side = right
  expect(Math.round(box.x + box.width)).toBe(1440);
  const main = (await page.locator('#main').boundingBox())!;
  expect(main.x + main.width).toBeLessThanOrEqual(box.x + 1);

  // greeting and checklist are translated; the counter keeps its left-to-right order
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Amel');
  await expect(page.getByText('ربط صفحة', { exact: true })).toBeVisible();
  await expect(page.getByTestId('checklist-count')).toHaveText('0 / 4');
  await expect(page.getByTestId('checklist-count')).toHaveAttribute('dir', 'ltr');

  // no horizontal overflow at 1440, 1024 (icon rail) and 390 (drawer)
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow at ${width}`).toBeLessThanOrEqual(0);
  }
  // 390: the sidebar is a drawer opened from the menu button, sliding in from the right
  await expect(sidebar).not.toBeInViewport();
  await page.getByRole('button', { name: 'القائمة' }).click();
  await expect(sidebar).toBeInViewport();
  await sidebar.getByRole('link', { name: 'الإعدادات', exact: true }).click();
  await expectUrl(page, '**/ar/settings/profile');
  await expect(page.getByRole('navigation', { name: 'الإعدادات' }).getByRole('link', { name: 'منطقة الخطر' })).toBeVisible();
});

test('AT-UX-02 the language dialog of the user menu switches locale and keeps the current page', async ({ page }) => {
  await login(page, account);
  await expectUrl(page, '**/fr/home');
  await page.goto('/fr/settings/security');
  await page.getByRole('button', { name: /Menu utilisateur/ }).click();
  await page.getByRole('menuitem', { name: 'Langue : Français' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Langue & région' })).toBeVisible();
  await dialog.getByRole('radio', { name: 'العربية' }).check();
  await dialog.getByRole('button', { name: 'Appliquer' }).click();
  await expectUrl(page, '**/ar/settings/security');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1, name: 'الأمان' })).toBeVisible();

  await page.getByRole('button', { name: /قائمة المستخدم/ }).click();
  await page.getByRole('menuitem', { name: /اللغة/ }).click();
  await page.getByRole('dialog').getByRole('radio', { name: 'English' }).check();
  await page.getByRole('dialog').getByRole('button', { name: 'تطبيق' }).click();
  await expectUrl(page, '**/en/settings/security');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});
