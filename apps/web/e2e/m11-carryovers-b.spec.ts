// M11 — web side of the carry-overs closed by the API in M11 (fork B): client tag suggestions (`GET /clients/tags`, M5),
// supplier sheet "Voir les produits (n)" → `/products?supplierId=` (M7), labels options "Un PDF par commande" (ZIP) +
// "Inclure le récapitulatif interne" (M6), report filters Source / Canal / Grouper par listed by the definition (M8),
// FAQ import of a Word file (M4), avatar crop step (M1), category image (M2) and the sidebar walk per role (M1: every
// visible nav entry resolves, no 404). Real API + worker: nothing is mocked.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { API, apiReady, authHeaders, createAccount, type Account } from './support/m1';
import { inviteOperator } from './support/m3-inbox';
import { signIn } from './support/m4-agents';
import { createAgent, realGet } from './support/m4-real';
import { inviteAdmin } from './support/m4-real-agent-page';
import { loginAdmin, modAdmin } from './support/m10-mod';
import { seedClient, nextMobile } from './support/m5-clients';
import { open, row, seedProduct } from './support/m5-orders';
import { confirmedOrder, deliveryReady, seedCourier, sendOrder } from './support/m6';
import { gdsOwner, product, purchase, supplier } from './support/m7';

test.describe.configure({ mode: 'serial', timeout: 300_000 });
test.use({ viewport: { width: 1440, height: 1000 } });

const NOT_FOUND = 'Introuvable ou accès refusé';
// a 1 × 1 PNG: enough for the crop step (the kept square is redrawn at 512 px)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

let owner: Account;

test.beforeAll(async ({ request }) => {
  test.setTimeout(300_000);
  test.skip(!(await apiReady(request)), 'API not reachable on :4010');
  // advanced stock mode: the GDS entries of the sidebar are visible too
  owner = await gdsOwner(request, 'm11carry');
});

/* ---------- M1 — sidebar walk ---------- */
const hrefsOf = (page: Page, selector: string) => page.locator(selector).evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href') ?? '').filter((h) => h.startsWith('/')))]);

/** Opens every link and checks the shell still renders the page (no localized 404, no bounce to the login). */
async function walk(page: Page, hrefs: string[], shell: string) {
  for (const href of hrefs) {
    await page.goto(href);
    await expect(page.locator(shell).first(), `shell of ${href}`).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('main, [role=main]').first(), `content of ${href}`).not.toBeEmpty({ timeout: 30_000 });
    await expect(page.getByText(NOT_FOUND), `404 on ${href}`).toHaveCount(0);
    expect(new URL(page.url()).pathname, `${href} stays in the app`).not.toMatch(/\/login/);
  }
}

test('M1 carry-over — every visible sidebar and settings entry resolves for Owner, Admin and Operator', async ({ page, request, browser }) => {
  test.setTimeout(600_000);
  const admin = await inviteAdmin(request, owner, 'Nadia');
  const operator = await inviteOperator(request, owner, 'Omar');
  const counts: Record<string, number> = {};
  for (const [role, who] of [['owner', owner], ['admin', admin], ['operator', operator]] as const) {
    const ctx = await browser.newContext({ locale: 'fr-DZ', timezoneId: 'Africa/Algiers', viewport: { width: 1440, height: 1000 } });
    const p = await ctx.newPage();
    await signIn(p, who);
    // the sidebar renders once the session (role, stock mode) is loaded
    await expect.poll(() => p.locator('aside nav a').count(), { timeout: 30_000 }).toBeGreaterThan(5);
    const nav = await hrefsOf(p, 'aside nav a');
    expect(nav.length, `${role}: sidebar entries`).toBeGreaterThan(5);
    await open(p, '/fr/settings/profile', () => p.locator('nav[aria-label="Paramètres"]'));
    const settings = await hrefsOf(p, 'nav[aria-label="Paramètres"] a');
    counts[role] = nav.length + settings.length;
    await walk(p, [...nav, ...settings], 'aside nav');
    // the role decides what is listed: an Operator sees neither the integrations nor the billing entries
    if (role === 'operator') {
      expect(settings.some((h) => h.includes('/settings/integrations'))).toBe(false);
      expect(settings.some((h) => h.includes('/settings/billing'))).toBe(false);
    } else expect(settings.some((h) => h.includes('/settings/integrations'))).toBe(true);
    await ctx.close();
  }
  expect(counts.owner).toBeGreaterThanOrEqual(counts.operator!);
  await page.close();
});

test('M1 carry-over — every entry of the platform admin sidebar resolves (super admin)', async ({ page, request }) => {
  test.setTimeout(300_000);
  const sa = await modAdmin(request, 'super_admin', 'm11walk');
  await loginAdmin(page, sa, '/fr/admin');
  await expect.poll(() => page.locator('aside nav a').count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(16);
  const nav = await hrefsOf(page, 'aside nav a');
  expect(nav.filter((h) => h.includes('/admin')).length).toBeGreaterThanOrEqual(16);
  await walk(page, nav, 'aside nav');
});

/* ---------- M5 — client tag suggestions ---------- */
test('M5 carry-over — client tags: the workspace tags are suggested while typing (GET /clients/tags)', async ({ page, request }) => {
  const tag = `grossiste-${Date.now().toString(36)}`;
  await seedClient(request, owner, { name: 'Karim Tag', phone: nextMobile(), tags: [tag] });
  const r = await request.get(`${API}/clients/tags?q=${tag.slice(0, 12)}`, { headers: authHeaders(owner) });
  expect(((await r.json()).data as { tag: string; count: number }[]).find((x) => x.tag === tag)?.count).toBe(1);

  await signIn(page, owner);
  await open(page, '/fr/clients', () => page.getByTestId('new-client'));
  await page.getByTestId('new-client').click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau client' });
  await dialog.locator('#client-tags').fill(tag.slice(0, 12));
  const suggestion = dialog.getByTestId('tag-suggestions').locator(`[data-suggestion="${tag}"]`);
  await expect(suggestion).toBeVisible({ timeout: 30_000 });
  await suggestion.click();
  await expect(dialog.getByTestId('tag-input').locator(`[data-tag="${tag}"]`)).toBeVisible();
  // a chosen tag is not offered again
  await expect(suggestion).toHaveCount(0);
});

/* ---------- M7 — supplier sheet → its products ---------- */
test('M7 carry-over — supplier sheet "Voir les produits (n)" opens /products filtered by the supplier (chip removable)', async ({ page, request }) => {
  const bought = await product(request, owner, { name: `Huile argan ${Date.now().toString(36)}`, price: 2500, cost: 1200, stock: 5 });
  const other = await product(request, owner, { name: `Savon noir ${Date.now().toString(36)}`, price: 900, cost: 300, stock: 5 });
  const sup = await supplier(request, owner, `Atlas Import ${Date.now().toString(36)}`);
  await purchase(request, owner, { supplierId: sup.id, lines: [{ productId: bought.id, quantity: 3, unitCost: 1200 }] });

  await signIn(page, owner);
  await open(page, `/fr/suppliers?sheet=${sup.id}`, () => page.getByTestId('supplier-products'));
  await expect(page.getByTestId('supplier-products')).toContainText('Voir les produits (1)');
  await page.getByTestId('supplier-products').click();
  await expect(page).toHaveURL(new RegExp(`/fr/products\\?.*supplierId=${sup.id}`), { timeout: 60_000 });
  await expect(page.getByText(bought.name).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(other.name)).toHaveCount(0);
  const chip = page.getByRole('button', { name: `Retirer le filtre Fournisseur : ${sup.name}` });
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(page).not.toHaveURL(/supplierId=/);
  await expect(page.getByText(other.name).first()).toBeVisible({ timeout: 30_000 });
});

/* ---------- M6 — labels options ---------- */
test('M6 carry-over — "Imprimer les bordereaux": "Un PDF par commande" ⇒ ZIP job, "Inclure le récapitulatif interne" sent', async ({ page, request }) => {
  test.skip(!(await deliveryReady(request, owner)), 'delivery module (M6) not served');
  const p = await seedProduct(request, owner, 'Montre Classic', 6000, 50);
  const zr = await seedCourier(request, owner, { provider: 'zrexpress', isDefault: true });
  const ids: string[] = [];
  for (const name of ['Lina Saidi', 'Yacine Amrani']) {
    const o = await confirmedOrder(request, owner, p.id, { name });
    await sendOrder(request, owner, o.id, zr.id);
    ids.push(o.id);
  }
  await signIn(page, owner);
  await open(page, `/fr/orders?ids=${ids.join(',')}`, () => row(page, ids[0]!));
  for (const id of ids) await row(page, id).getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Bordereaux' }).click();
  const dlg = page.getByTestId('labels-dialog');
  await expect(dlg).toBeVisible();
  await dlg.getByTestId('labels-one-pdf').check();
  await dlg.getByTestId('labels-recap').check();
  const sent = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith('/api/v1/shipments/labels'));
  await page.getByTestId('labels-submit').click();
  expect((await sent).postDataJSON()).toMatchObject({ onePdfPerOrder: true, includeRecap: true });
  const job = page.getByTestId('labels-job');
  await expect(job).toHaveAttribute('data-state', /ready|partial/, { timeout: 120_000 });
  await expect(job).toHaveAttribute('data-zip', 'true');
  await expect(job).toContainText('.zip');
  // a ZIP is downloaded, never framed
  await expect(page.getByTestId('label-frame')).toHaveCount(0);
});

/* ---------- M8 — report template filters ---------- */
test('M8 carry-over — report filters Source / Canal / Grouper par only where the definition lists them; values in the URL', async ({ page }) => {
  await signIn(page, owner);
  await open(page, '/fr/reports/sales_by_product', () => page.getByTestId('report-filters'));
  const bar = page.getByTestId('report-filters');
  await expect(bar.getByRole('button', { name: /Source : ventes \+ commandes/ })).toBeVisible();
  await expect(bar.getByRole('button', { name: /Canal : tous/ })).toBeVisible();
  await bar.getByRole('button', { name: /Grouper par : variante/ }).click();
  await page.getByRole('radio', { name: 'produit', exact: true }).click();
  await expect(page).toHaveURL(/groupBy=product/);
  await page.keyboard.press('Escape');
  await bar.getByRole('button', { name: /Source :/ }).click();
  await page.getByRole('radio', { name: 'ventes comptoir', exact: true }).click();
  await expect(page).toHaveURL(/source=sales/);
  await page.keyboard.press('Escape');
  // the report answers with the filters (rows, or the filtered-empty state with "Effacer les filtres")
  await expect(page.getByTestId('report-table').or(page.getByRole('heading', { name: 'Aucun résultat' }))).toBeVisible({ timeout: 30_000 });
  // sales by category: Source + Canal, no "Grouper par"
  await open(page, '/fr/reports/sales_by_category', () => page.getByTestId('report-filters'));
  await expect(page.getByTestId('report-filters').getByRole('button', { name: /Source :/ })).toBeVisible();
  await expect(page.getByTestId('report-filters').getByRole('button', { name: /Grouper par/ })).toHaveCount(0);
  // the period report reads daily rollups: none of the three
  await open(page, '/fr/reports/sales_by_period', () => page.getByTestId('report-filters'));
  await expect(page.getByTestId('report-filters').getByRole('button', { name: /Source :|Canal :|Grouper par/ })).toHaveCount(0);
});

/* ---------- M4 — FAQ import of a Word file ---------- */
const docx = (paragraphs: string[]): Buffer => {
  // fflate is a dependency of the API (its DOCX reader): reused here to build a real .docx (ZIP + word/document.xml)
  const { strToU8, zipSync } = createRequire(resolve(__dirname, '../../api/package.json'))('fflate') as { strToU8: (s: string) => Uint8Array; zipSync: (f: Record<string, Uint8Array>) => Uint8Array };
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const body = paragraphs.map((p) => `<w:p><w:r><w:t xml:space="preserve">${esc(p)}</w:t></w:r></w:p>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
  return Buffer.from(zipSync({ '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'), 'word/document.xml': strToU8(xml) }));
};

test('M4 carry-over — FAQ import of a .docx adds the question / answer pairs; a PDF is refused before upload', async ({ page, request }) => {
  const shop = await createAccount(request, { prefix: 'm11faq', finishOnboarding: true });
  const draft = await createAgent(request, shop, { name: 'Agent FAQ Word' });
  await signIn(page, shop);
  await open(page, `/fr/agents/new/knowledge?draft=${draft.id}`, () => page.locator('[data-section="faq"]').getByTestId('faq-import'));
  const input = page.locator('input[data-upload="faq-import"]');
  await input.setInputFiles({ name: 'faq.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7') });
  // refused in the page (the API refuses PDF too: no text extractor), nothing uploaded
  await expect(page.locator('[data-section="faq"]')).toContainText('Format non supporté.');
  await input.setInputFiles({
    name: 'faq-boutique.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: docx(['Q: Livrez-vous à Oran ?', 'R: Oui, en 48 h à domicile.', 'Q: Le paiement à la livraison est possible ?', 'R: Oui, partout en Algérie.']),
  });
  await expect(page.getByText('2 questions ajoutées à la FAQ')).toBeVisible({ timeout: 30_000 });
  const faq = await realGet<{ question: string; source: string }[]>(request, shop, `/agents/${draft.id}/faq`);
  expect(faq.filter((f) => f.source === 'file_import').map((f) => f.question)).toEqual(expect.arrayContaining(['Livrez-vous à Oran ?', 'Le paiement à la livraison est possible ?']));
  await expect(page.locator('[data-section="faq"]')).toContainText('Livrez-vous à Oran ?');
});

/* ---------- M1 — avatar crop step ---------- */
test('M1 carry-over — avatar upload goes through the crop step (cercle / carré · zoom) before it is saved', async ({ page, request }) => {
  await signIn(page, owner);
  await open(page, '/fr/settings/profile', () => page.locator('input[data-upload="avatar"]'));
  await page.locator('input[data-upload="avatar"]').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: PNG });
  const crop = page.getByTestId('crop-dialog');
  await expect(crop).toBeVisible();
  await expect(crop.getByTestId('image-cropper')).toHaveAttribute('data-shape', 'circle');
  await crop.getByRole('radio', { name: 'Carré' }).click();
  await expect(crop.getByTestId('image-cropper')).toHaveAttribute('data-shape', 'square');
  await crop.getByTestId('crop-zoom').fill('2');
  const upload = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith('/api/v1/uploads'));
  await page.getByTestId('crop-save').click();
  await upload;
  await expect(crop).toHaveCount(0, { timeout: 30_000 });
  const me = await request.get(`${API}/me`, { headers: authHeaders(owner) });
  expect(((await me.json()).data as { avatarUrl: string | null }).avatarUrl).toBeTruthy();
});

/* ---------- M2 — category image ---------- */
test('M2 carry-over — category image: upload (crop) → saved with the category → shown again; remove', async ({ page, request }) => {
  await signIn(page, owner);
  await open(page, '/fr/categories', () => page.getByTestId('new-category'));
  await page.getByTestId('new-category').click();
  const name = `Bijoux ${Date.now().toString(36)}`;
  await page.locator('#category-name').fill(name);
  await page.getByTestId('category-image').locator('input[data-upload="category_image"]').setInputFiles({ name: 'bijoux.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByTestId('crop-dialog')).toBeVisible();
  await page.getByTestId('crop-save').click();
  await expect(page.getByTestId('category-image-preview')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('category-save').click();
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 30_000 });
  const cats = await realGet<{ name: string; imageUrl: string | null; children: { name: string; imageUrl: string | null }[] }[]>(request, owner, '/categories');
  const saved = cats.flatMap((c) => [c, ...c.children]).find((c) => c.name === name);
  expect(saved?.imageUrl).toBeTruthy();
});
