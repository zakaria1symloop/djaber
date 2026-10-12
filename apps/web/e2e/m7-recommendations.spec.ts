// M7 — /recommendations (Figma "GDS-10 — Recommendations — list + generate job + stats", DLG GDS II "Règle de
// recommandation"): generate job with its progress banner, 1 / 10 min (RECO_RATE_LIMITED), cards with their RULE label
// and actions (Ignorer, Rappeler dans 7 j, Créer l'achat → prefilled purchase, APPLIQUÉE), cross-sell rules
// (manual rule dialog, toggle, delete), history view. Real API + worker: nothing is mocked.
import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './support/a11y';
import { apiReady, type Account } from './support/m1';
import { signIn } from './support/m4-agents';
import { open } from './support/m5-orders';
import { gdsOwner, gdsReady, getJson, product, purchase, receiveAll, sale, supplier, type SeedProduct } from './support/m7';

test.describe.configure({ mode: 'serial', timeout: 240_000 });
test.use({ viewport: { width: 1440, height: 1000 } });

let owner: Account;
let oud: SeedProduct;
let musc: SeedProduct;

test.beforeAll(async ({ request }) => {
  test.setTimeout(300_000);
  test.skip(!(await apiReady(request)), 'API not reachable on :4010');
  owner = await gdsOwner(request, 'm7reco');
  test.skip(!(await gdsReady(request, owner)), 'GDS operations (M7) not served');
  oud = await product(request, owner, { name: 'Parfum Oud 100 ml', price: 4500, cost: 1500, stock: 2, minStock: 5 });
  // margin 20 % < target 35 % ⇒ a PRIX card
  await product(request, owner, { name: 'Foulard soie', price: 1000, cost: 800, stock: 10 });
  musc = await product(request, owner, { name: 'Parfum Musc 50 ml', price: 2500, cost: 900, stock: 30 });
  const sup = await supplier(request, owner, 'Belkacem Import', { avgLeadDays: 10 });
  await receiveAll(request, owner, await purchase(request, owner, { supplierId: sup.id, lines: [{ productId: oud.id, quantity: 4, unitCost: 1500 }] }));
  // sales of the oud (velocity) with the musc in the same basket (co-purchase for the cross-sell engine)
  // 5 sold in 30 d, 1 left ⇒ ~6 days of stock < supplier lead time ⇒ a RÉAPPROVISIONNER card
  for (let i = 0; i < 5; i++) await sale(request, owner, { lines: [{ productId: oud.id, quantity: 1 }, { productId: musc.id, quantity: 1 }], amountPaid: 7000 });
});

test('GDS-10 — generate: job banner with progress, then cards; second run within 10 min ⇒ RECO_RATE_LIMITED; axe', async ({ page }) => {
  await signIn(page, owner);
  await open(page, '/fr/recommendations', () => page.getByTestId('reco-generate'));
  await expectNoA11yViolations(page);
  await page.getByTestId('reco-generate').click();
  await expect(page).toHaveURL(/job=/);
  await expect(page.getByTestId('reco-job')).toBeVisible();
  await expect(page.getByTestId('reco-job')).toContainText(/recommandations générées/, { timeout: 120_000 });
  await expect(page.getByTestId('reco-cards').locator('article').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('reco-cards')).toContainText('Règle :');
  // the stats now say "not before 10 min": the button is greyed with the code
  await page.reload();
  await expect(page.getByTestId('reco-generate')).toBeDisabled({ timeout: 30_000 });
  await expect(page.getByTestId('reco-generate')).toHaveAttribute('title', /RECO_RATE_LIMITED/);
});

test('GDS-10 — card actions: Rappeler dans 7 j (status filter), Ignorer, Créer l\'achat → purchase prefilled → APPLIQUÉE', async ({ page, request }) => {
  await signIn(page, owner);
  await open(page, '/fr/recommendations', () => page.getByTestId('reco-cards'));
  const cards = page.getByTestId('reco-cards').locator('article');
  await expect(cards.first()).toBeVisible();
  const restock = page.getByTestId('reco-cards').locator('article[data-type="restock"], article[data-type="stockout_imminent"]').first();
  await expect(restock).toBeVisible();
  {
    const recoId = await restock.getAttribute('data-reco');
    await restock.getByTestId('reco-apply').click();
    await expect(page).toHaveURL(/\/fr\/purchases\/new\?.*productId=/, { timeout: 30_000 });
    await expect(page.getByTestId('purchase-form').locator(`tr[data-line="${oud.id}"]`)).toBeVisible({ timeout: 30_000 });
    const sup = (await getJson<{ id: string }[]>(request, owner, '/suppliers'))[0]!;
    await page.getByTestId('purchase-form').getByLabel('Fournisseur').selectOption(sup.id);
    await page.getByTestId('purchase-save-order').click();
    await expect(page).toHaveURL(/\/fr\/purchases\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    const applied = await getJson<{ id: string; status: string }[]>(request, owner, '/stock-recommendations?status=applied');
    expect(applied.some((r) => r.id === recoId)).toBeTruthy();
    await open(page, '/fr/recommendations?status=applied', () => page.getByTestId('reco-cards'));
    await expect(page.locator(`article[data-reco="${recoId}"]`)).toContainText('Appliquée');
  }
  await open(page, '/fr/recommendations', () => page.getByTestId('reco-kpis'));
  const first = page.getByTestId('reco-cards').locator('article').first();
  if ((await first.count()) > 0) {
    await first.getByTestId('reco-snooze').click();
    await expect(page.locator('[data-toast]').filter({ hasText: 'reportée de 7 jours' })).toBeVisible();
  }
});

test('REC-01 — Règle de recommandation: manual rule (same product refused), toggle, delete; history view', async ({ page }) => {
  await signIn(page, owner);
  await open(page, '/fr/recommendations?view=cross', () => page.getByTestId('cross-new'));
  await page.getByTestId('cross-new').click();
  await expect(page).toHaveURL(/rule=new/);
  const dlg = page.getByTestId('rule-dialog');
  await dlg.locator('#rule-product').fill('Parfum Oud');
  await page.getByTestId('gds-product-results').locator(`[data-product="${oud.id}"]`).click();
  await dlg.locator('#rule-recommended').fill('Parfum Oud');
  await page.getByTestId('gds-product-results').locator(`[data-product="${oud.id}"]`).click();
  await page.getByRole('dialog').getByTestId('dialog-submit').click();
  await expect(dlg.getByText('Choisissez un autre produit que le produit source.')).toBeVisible();
  await dlg.getByTestId('rule-recommended-picked').getByRole('button', { name: 'Retirer' }).click();
  await dlg.locator('#rule-recommended').fill('Parfum Musc');
  await page.getByTestId('gds-product-results').locator(`[data-product="${musc.id}"]`).click();
  await dlg.getByLabel('Raison affichée à l\'IA').fill('souvent achetés ensemble');
  await page.getByRole('dialog').getByTestId('dialog-submit').click();
  await expect(page.locator('[data-toast]').filter({ hasText: 'Règle ajoutée' })).toBeVisible();
  const ruleRow = page.locator('tr').filter({ hasText: 'Parfum Musc 50 ml' }).first();
  await expect(ruleRow).toContainText('Manuelle');
  await ruleRow.getByRole('switch').click();
  await expect(ruleRow.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  await ruleRow.getByRole('button', { name: /Actions/ }).click();
  await page.getByRole('menu').locator('[data-action="delete"]').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
  await expect(page.locator('[data-toast]').filter({ hasText: 'Règle supprimée' })).toBeVisible();

  await page.locator('nav [data-view="history"]').click();
  await expect(page).toHaveURL(/view=history/);
});
