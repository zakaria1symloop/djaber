import { expect, test } from '@playwright/test';

test.describe('M0 — shell and GLOBAL states', () => {
  test('root redirects to the default locale', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/fr(\/|$)/);
  });

  test('French shell: sidebar, banner, list states', async ({ page }) => {
    await page.goto('/fr/dev/states');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('link', { name: 'Accueil', exact: true })).toBeVisible();
    await expect(page.getByText('Aucune commande')).toBeVisible();
    await expect(page.getByText('Impossible de charger')).toBeVisible();
    await expect(page.getByText('Session expirée')).toBeVisible();
  });

  test('Arabic is right-to-left and translated', async ({ page }) => {
    await page.goto('/ar/dev/states');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByText('لا توجد طلبات')).toBeVisible();
  });

  test('leave guard dialog opens and closes', async ({ page }) => {
    await page.goto('/fr/dev/states');
    await page.getByRole('button', { name: 'Quitter sans enregistrer ?' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Rester' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('unknown page shows the localized 404', async ({ page }) => {
    await page.goto('/fr/this-page-does-not-exist');
    await expect(page.getByText('Introuvable ou accès refusé')).toBeVisible();
  });
});
