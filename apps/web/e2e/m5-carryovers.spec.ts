// M5 — links that earlier screens were waiting for (docs/implementation/carry-overs.md, rows closed in M5):
//  - inbox client panel + conversation menu: order cards → /orders/:id, "Nouvelle commande pour {client}",
//    "Fiche client" / "Compléter la fiche" → client sheet, "Commandes de ce client", "Marquer « risque »";
//  - products "Commandes de ce produit"; agents "Voir les commandes générées" + agent page Conversations / Commandes;
//  - channel overview tile "COMMANDES IA (30 J)" (figure of `GET /orders/stats`).
// On the REAL API (fake Meta pages, deterministic fake AI, worker running).
import { expect, test } from '@playwright/test';
import { apiReady, expectUrl, loginHome } from './support/m1';
import { activeAgent, customerSays, nextSender, setupShop, type RealAgent, type Shop } from './support/m4-real';
import { clientsReady, clientWithOrder, get, ordersReady, patch } from './support/m5-home';

test.describe.configure({ mode: 'serial', timeout: 240_000 });
let shop: Shop;
let agent: RealAgent;
let conversationId: string;
let clientId: string;

test.beforeAll(async ({ request }) => {
  test.skip(!(await apiReady(request)), 'API not reachable on :4010');
  shop = await setupShop(request, 'm5-carry');
  test.skip(!(await ordersReady(request, shop.owner)) || !(await clientsReady(request, shop.owner)), 'M5 orders / clients API not reachable');
  agent = await activeAgent(request, shop.owner, { name: 'Vendeur Pro', channelId: shop.facebook.id });
  const { conversation } = await customerSays(request, shop.owner, { channelId: shop.facebook.id, sender: nextSender(), text: 'salam' });
  conversationId = conversation.id;
  clientId = (conversation.client as { id: string; name: string }).id;
});

test('inbox: a placeholder client offers "Compléter la fiche" (→ client sheet), no order button yet', async ({ page }) => {
  await loginHome(page, shop.owner);
  await page.goto(`/fr/inbox/${conversationId}`);
  const panel = page.getByTestId('client-panel');
  await expect(panel.getByTestId('client-sheet-link')).toHaveText('Compléter la fiche');
  await expect(panel.getByTestId('client-panel-new-order')).toHaveCount(0);
  await panel.getByTestId('client-sheet-link').click();
  await expectUrl(page, `**/fr/clients?sheet=${clientId}`);
});

test('inbox: a completed client with an order — order card → order page, "Nouvelle commande pour …", "Commandes de ce client"', async ({ page, request }) => {
  // the client of the conversation gets a name and a phone, then one manual order of the catalogue
  await patch(request, shop.owner, `/clients/${clientId}`, { name: 'Amina Belkacem', phone: `05${String(Date.now()).slice(-8)}` });
  const client = await get<{ phone: string }>(request, shop.owner, `/clients/${clientId}`);
  const order = await clientWithOrder(request, shop.owner, { name: 'Amina Belkacem', phone: client.phone, productId: shop.products[0]!.id });
  expect(order.clientId).toBe(clientId);

  await loginHome(page, shop.owner);
  await page.goto(`/fr/inbox/${conversationId}`);
  const panel = page.getByTestId('client-panel');
  await expect(panel.getByTestId('client-sheet-link')).toHaveText('Fiche client');
  await expect(panel.getByTestId('client-panel-new-order')).toHaveText('Nouvelle commande pour Amina');
  await expect(panel.getByTestId('client-panel-new-order')).toHaveAttribute('href', `/fr/orders/new?clientId=${clientId}&conversationId=${conversationId}`);
  await expect(panel.getByTestId('client-orders-link')).toHaveAttribute('href', `/fr/orders?clientId=${clientId}`);
  await panel.getByTestId('client-panel-order').first().click();
  await expectUrl(page, `**/fr/orders/${order.orderId}`);
});

test('inbox menu: "Fiche client", "Commandes de ce client", "Marquer « risque »" (POST /clients/:id/risk)', async ({ page, request }) => {
  await loginHome(page, shop.owner);
  await page.goto(`/fr/inbox/${conversationId}`);
  await page.getByTestId('thread').getByRole('button', { name: 'Actions', exact: true }).click();
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem', { name: 'Fiche client' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Commandes de ce client' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: /Nouvelle commande pour/ })).toBeVisible();
  const risk = page.waitForRequest((r) => r.method() === 'POST' && r.url().includes(`/clients/${clientId}/risk`));
  await menu.getByRole('menuitem', { name: 'Marquer « risque »' }).click();
  expect((await risk).postDataJSON()).toEqual({ riskLevel: 'high' });
  await expect(page.getByText('Client marqué « risque »', { exact: true })).toBeVisible();
  await expect.poll(async () => (await get<{ riskLevel: string }>(request, shop.owner, `/clients/${clientId}`)).riskLevel).toBe('high');
});

test('products: "Commandes de ce produit" opens the orders list filtered by the product', async ({ page }) => {
  await loginHome(page, shop.owner);
  await page.goto('/fr/products');
  const product = shop.products[0]!;
  await page.locator(`tr[data-row="${product.id}"]`).getByRole('button', { name: /Actions/ }).click();
  await page.getByRole('menuitem', { name: 'Commandes de ce produit' }).click();
  await expectUrl(page, `**/fr/orders?productId=${product.id}`);
});

test('agents: "Voir les commandes générées" and the agent page tabs Conversations / Commandes', async ({ page }) => {
  await loginHome(page, shop.owner);
  await page.goto('/fr/agents');
  await page.locator(`[data-agent="${agent.id}"]`).getByRole('button', { name: 'Actions', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Voir les commandes générées' }).click();
  await expectUrl(page, `**/fr/orders?source=ai&agentId=${agent.id}`);
  await page.goto(`/fr/agents/${agent.id}`);
  await expect(page.getByTestId('agent-tab-conversations')).toHaveAttribute('href', `/fr/inbox?agentId=${agent.id}`);
  await page.getByTestId('agent-tab-orders').click();
  await expectUrl(page, `**/fr/orders?source=ai&agentId=${agent.id}`);
});

test('channel overview: "COMMANDES IA (30 J)" equals GET /orders/stats and opens the filtered list', async ({ page, request }) => {
  const stats = await get<{ total: number }>(request, shop.owner, `/orders/stats?channelId=${shop.facebook.id}&source=ai&period=30d`);
  await loginHome(page, shop.owner);
  await page.goto(`/fr/channels/${shop.facebook.id}`);
  const tile = page.getByTestId('channel-ai-orders');
  await expect(tile).toContainText('COMMANDES IA (30 J)');
  await expect(tile).toContainText(String(stats.total));
  await tile.click();
  await expectUrl(page, `**/fr/orders?channelId=${shop.facebook.id}&source=ai&period=30d`);
});
