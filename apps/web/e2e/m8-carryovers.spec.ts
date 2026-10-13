// M8 — carry-overs closed with the analytics & reports module: channel overview "Résolution IA" (M3), order export PDF
// (M5), home "À traiter" handled cards greyed 24 h "fait par …" (M5), /delivery bulk "Exporter CSV" + Analytics ›
// Livraison couriers table (M6), "Exporter" of /purchases and /sales listed in Rapports › Exports récents (M7).
// Real API + worker (fake drivers): nothing is mocked.
import { expect, test } from '@playwright/test';
import { apiReady, type Account } from './support/m1';
import { signIn } from './support/m4-agents';
import { setupShop } from './support/m4-real';
import { apiCall, open, row, seedOrder, seedProduct, shopOwner } from './support/m5-orders';
import { confirmedOrder, seedCourier, sendOrder, waitParcel } from './support/m6';
import { gdsOwner, product, purchase, sale, supplier } from './support/m7';
import { analyticsReady, apiGet, waitJob } from './support/m8';

test.describe.configure({ mode: 'serial', timeout: 240_000 });
test.use({ viewport: { width: 1440, height: 1000 } });

let ready = false;
test.beforeAll(async ({ request }) => {
  test.setTimeout(120_000);
  test.skip(!(await apiReady(request)), 'API not reachable on :4010');
  const probe = await shopOwner(request, 'm8probe');
  ready = await analyticsReady(request, probe);
  test.skip(!ready, 'analytics (M8) not served');
});

const jobOf = async (resp: Promise<import('@playwright/test').Response>) => ((await (await resp).json()) as { data: { jobId: string } }).data.jobId;

test('M3 carry-over — channel overview "Résolution IA" (30 d) tile, linked to the page-filtered analytics', async ({ page, request }) => {
  const shop = await setupShop(request, 'm8chn', { products: false });
  const ch = shop.facebook;
  const summary = await apiGet<{ aiResolutionPct30d: number | null }>(request, shop.owner, `/channels/${ch.id}/summary`);
  await signIn(page, shop.owner);
  await open(page, `/fr/channels/${ch.id}`, () => page.getByTestId('channel-ai-resolution'));
  const tile = page.getByTestId('channel-ai-resolution');
  await expect(tile).toContainText('RÉSOLUTION IA');
  await expect(tile).toContainText(summary.aiResolutionPct30d === null ? '—' : `${String(summary.aiResolutionPct30d).replace('.', ',')} %`);
  await tile.click();
  await expect(page).toHaveURL(new RegExp(`/fr/analytics/conversations\\?period=30d&channelId=${ch.id}`));
  await expect(page.getByRole('button', { name: new RegExp(`^Page : ${ch.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) })).toBeVisible({ timeout: 30_000 });
});

test('M5 carry-over — "Exporter les commandes" offers PDF (A4 landscape table) → job', async ({ page, request }) => {
  const owner = await shopOwner(request, 'm8pdf');
  const p = await seedProduct(request, owner, 'Parfum Oud 50 ml', 4700);
  await seedOrder(request, owner, { productId: p.id, name: 'Amina Belkacem' });
  await signIn(page, owner);
  await open(page, '/fr/orders', () => page.getByRole('button', { name: 'Exporter', exact: true }));
  await page.getByRole('button', { name: 'Exporter', exact: true }).click();
  await page.getByTestId('export-dialog').locator('#exp-format').selectOption('pdf');
  const started = page.waitForResponse((r) => /\/orders\/export\?.*format=pdf/.test(r.url()) && r.status() === 202);
  await page.getByTestId('export-submit').click();
  const job = await waitJob(request, owner, await jobOf(started));
  expect(job.status).toBe('done');
});

test('M6 carry-over — /delivery bulk "Exporter CSV" → job; Analytics › Livraison lists the courier', async ({ page, request }) => {
  const owner = await shopOwner(request, 'm8dlv');
  const p = await seedProduct(request, owner, 'Robe satin', 4900);
  const zr = await seedCourier(request, owner, { provider: 'zrexpress', isDefault: true });
  const o = await confirmedOrder(request, owner, p.id, { name: 'Lina Saidi' });
  const parcel = await sendOrder(request, owner, o.id, zr.id);
  await waitParcel(request, owner, parcel.id);
  await signIn(page, owner);
  await open(page, '/fr/delivery?tab=all', () => row(page, o.id));
  await row(page, o.id).getByRole('checkbox').check();
  const started = page.waitForResponse((r) => /\/delivery\/export\?/.test(r.url()) && r.status() === 202);
  await page.getByRole('button', { name: 'Exporter CSV' }).click();
  const job = await waitJob(request, owner, await jobOf(started));
  expect(job.status).toBe('done');

  await open(page, '/fr/analytics/delivery', () => page.getByTestId('tab-table').locator('tr[data-row]').first());
  await expect(page.getByTestId('tab-table')).toContainText(/ZR/i);
  await expect(page.locator('[data-kpi="shipped"] bdi.ts-numeral-l')).toHaveText('1');
});

test('M7 carry-over — "Exporter" of /sales and /purchases → jobs listed in Rapports › Exports récents', async ({ page, request }) => {
  const owner = await gdsOwner(request, 'm8exp');
  const p = await product(request, owner, { name: 'Sac cuir camel', price: 5000, cost: 2500, stock: 10 });
  await sale(request, owner, { lines: [{ productId: p.id, quantity: 1 }], amountPaid: 5000 });
  const sup = await supplier(request, owner, 'Belkacem Import');
  await purchase(request, owner, { supplierId: sup.id, lines: [{ productId: p.id, quantity: 3, unitCost: 2500 }] });
  await signIn(page, owner);

  await open(page, '/fr/sales', () => page.getByTestId('list-export'));
  let started = page.waitForResponse((r) => /\/sales\/export\?/.test(r.url()) && r.status() === 202);
  await page.getByTestId('list-export').click();
  await page.locator('[data-export="xlsx"]').click();
  const saleJob = await jobOf(started);
  await open(page, '/fr/purchases', () => page.getByTestId('list-export'));
  started = page.waitForResponse((r) => /\/purchases\/export\?/.test(r.url()) && r.status() === 202);
  await page.getByTestId('list-export').click();
  await page.locator('[data-export="csv"]').click();
  const purchaseJob = await jobOf(started);
  expect((await waitJob(request, owner, saleJob)).status).toBe('done');
  expect((await waitJob(request, owner, purchaseJob)).status).toBe('done');

  await open(page, '/fr/reports', () => page.getByTestId('export-jobs').locator(`[data-job="${saleJob}"]`));
  for (const id of [saleJob, purchaseJob]) {
    const r = page.getByTestId('export-jobs').locator(`[data-job="${id}"]`);
    await expect(r.getByTestId('job-pill')).toContainText('PRÊT');
    await expect(r.getByTestId('job-download')).toBeVisible();
  }
});

test('M5 carry-over — home "À traiter": a callback handled by a member stays greyed 24 h with "fait par …"', async ({ page, request }) => {
  const owner = await shopOwner(request, 'm8home');
  const p = await seedProduct(request, owner, 'Foulard soie', 2400);
  const o = await seedOrder(request, owner, { productId: p.id, name: 'Yacine Merad' });
  const later = new Date(Date.now() + 3 * 3600_000).toISOString();
  const call = (data: Record<string, unknown>) => apiCall(request, owner, 'POST', `/orders/${o.id}/calls`, data);
  expect((await call({ result: 'callback', callbackAt: later })).status).toBeLessThan(300);
  expect((await call({ result: 'no_answer' })).status).toBeLessThan(300);
  const home = await apiGet<{ queue: { items: { key: string; handled?: { by: { name: string } | null } }[] } }>(request, owner, '/dashboard/home');
  const handled = home.queue.items.find((i) => i.key === `callback:${o.id}:handled`);
  expect(handled?.handled?.by?.name).toContain(owner.firstName);
  await signIn(page, owner);
  await open(page, '/fr/home', () => page.getByTestId('home-queue'));
  const card = page.getByTestId('home-queue-handled').filter({ hasText: o.number });
  await expect(card).toBeVisible();
  await expect(card).toContainText(`fait par ${owner.firstName}`);
  await expect(card.locator('[data-handled]')).toHaveCSS('opacity', '0.5');
});
