// Definition of done item 8: axe check on the default state of each screen that can be opened without a session.
// Screens behind the session are checked inside their own milestone specs with `expectNoA11yViolations(page)`.
import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './support/a11y';

for (const path of ['/fr/login', '/fr/signup', '/fr/forgot-password', '/ar/login', '/fr/dev/states']) {
  test(`a11y — ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('h1').first()).toBeVisible();
    await expectNoA11yViolations(page);
  });
}
