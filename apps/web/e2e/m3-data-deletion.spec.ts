// M3 — public status page of a Meta data-deletion request (PUB — … Meta data-deletion status, MSG-08, AT-MSG-07 UI
// side): EN COURS · TERMINÉ · INTROUVABLE (404), no session, fr / ar / en. A request is created by Meta's signed
// callback only: "pending" and "done" are served from contract-shaped fixtures; the unknown code hits the real API.
import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './support/a11y';
import { apiReady } from './support/m1';
import { fulfil } from './support/m3-misc';

test('data-deletion status EN COURS: code, request date, 30-day notice, legal note, no navigation, axe', async ({ page }) => {
  await page.route(/\/api\/v1\/data-deletion\/8F2A-19/, (r) => fulfil(r, { code: '8F2A-19', status: 'pending', requestedAt: '2026-10-05T09:00:00.000Z', completedAt: null }));
  await page.goto('/fr/meta/data-deletion/8F2A-19');
  const card = page.getByTestId('data-deletion');
  await expect(card).toHaveAttribute('data-status', 'pending');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Suppression des données — code 8F2A-19');
  await expect(card).toContainText('EN COURS');
  await expect(page.getByTestId('data-deletion-text')).toHaveText('Demande reçue le 05 oct. 2026 · traitement sous 30 jours.');
  await expect(card).toContainText('Les commandes déjà livrées restent dans les factures des marchands sans votre nom (obligation légale).');
  // public page: no sidebar, no login redirect
  await expect(page.getByRole('complementary')).toHaveCount(0);
  await expect(page).toHaveURL(/\/fr\/meta\/data-deletion\/8F2A-19$/);
  await expectNoA11yViolations(page);
});

test('data-deletion status TERMINÉ, and the FR · AR · EN switch keeps the code', async ({ page }) => {
  await page.route(/\/api\/v1\/data-deletion\/DONE-42/, (r) => fulfil(r, { code: 'DONE-42', status: 'done', requestedAt: '2026-10-05T09:00:00.000Z', completedAt: '2026-10-06T08:00:00.000Z' }));
  await page.goto('/fr/meta/data-deletion/DONE-42');
  const card = page.getByTestId('data-deletion');
  await expect(card).toHaveAttribute('data-status', 'done');
  await expect(card).toContainText('TERMINÉ');
  await expect(page.getByTestId('data-deletion-text')).toHaveText('Données supprimées le 06 oct. 2026 (conversations, profil client anonymisés dans tous les espaces).');

  await page.getByRole('group', { name: 'Langue' }).getByRole('button', { name: 'ar' }).click();
  await expect(page).toHaveURL(/\/ar\/meta\/data-deletion\/DONE-42$/);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByTestId('data-deletion')).toContainText('اكتمل');
  // the code keeps its left-to-right order
  await expect(page.getByRole('heading', { level: 1 }).locator('bdi')).toHaveAttribute('dir', 'ltr');
  await page.getByRole('group', { name: 'اللغة' }).getByRole('button', { name: 'en' }).click();
  await expect(page).toHaveURL(/\/en\/meta\/data-deletion\/DONE-42$/);
  await expect(page.getByTestId('data-deletion')).toContainText('DONE');
});

test('data-deletion status INTROUVABLE for an unknown code (real API: 404 or status not_found)', async ({ page, request }) => {
  test.skip(!(await apiReady(request)), 'API not reachable on :4010');
  await page.goto('/fr/meta/data-deletion/zz-unknown-code');
  const card = page.getByTestId('data-deletion');
  await expect(card).toHaveAttribute('data-status', 'not_found');
  await expect(card).toContainText('INTROUVABLE');
  await expect(page.getByTestId('data-deletion-text')).toHaveText('Code inconnu (404).');
});

test('data-deletion status: a server error shows the error state with "Réessayer"', async ({ page }) => {
  let calls = 0;
  await page.route(/\/api\/v1\/data-deletion\/ERR-1/, (r) => {
    calls++;
    return calls <= 2 ? fulfil(r, { code: 'INTERNAL', message: 'Erreur interne', ref: 'req-e2e' }, {}, 500) : fulfil(r, { code: 'ERR-1', status: 'pending', requestedAt: '2026-10-05T09:00:00.000Z', completedAt: null });
  });
  await page.goto('/fr/meta/data-deletion/ERR-1');
  await expect(page.getByTestId('data-deletion')).toHaveAttribute('data-status', 'error', { timeout: 15_000 });
  await expect(page.getByText('Impossible de charger')).toBeVisible();
  await page.getByRole('button', { name: 'Réessayer' }).click();
  await expect(page.getByTestId('data-deletion')).toHaveAttribute('data-status', 'pending');
});
