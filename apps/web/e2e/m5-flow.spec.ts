// M5 — end to end on the REAL API (fake Meta pages, deterministic fake AI provider `GET /dev/ai/help`, worker running):
// a customer writes on the connected page, gives a phone number and confirms ("je confirme"); the AI calls
// `create_order` (bound to the orders module in M5) and the new order appears live in the open /orders list (WS
// `order.created`, no reload) with the ✦ IA source; the owner opens it, confirms it through the confirm dialog
// (outcome "Confirmée", address completed from the dialog when the AI left the commune empty) and prints the A5 slip.
// Nothing here is mocked.
import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './support/a11y';
import { apiReady, expectUrl, type Account } from './support/m1';
import { signIn } from './support/m4-agents';
import { activeAgent, conversationOf, inject, nextSender, setupShop, waitAiMessages, type Shop } from './support/m4-real';
import { apiCall, getOrder, ordersReady } from './support/m5-orders';

test.describe.configure({ mode: 'serial', timeout: 240_000 });
test.use({ viewport: { width: 1440, height: 1000 } });

let shop: Shop;
let owner: Account;
const request = (page: Page) => page.context().request;

test.beforeAll(async ({ request: r }) => {
  test.setTimeout(300_000);
  test.skip(!(await apiReady(r)), 'API not reachable on :4010');
  shop = await setupShop(r, 'm5flow');
  owner = shop.owner;
  test.skip(!(await ordersReady(r, owner)), 'orders module (M5) not served');
  await activeAgent(r, owner, { name: `Vendeur flux ${Date.now().toString(36)}`, channelId: shop.facebook.id });
});

type OrderRow = { id: string; number: string; source: { source: string }; conversationId: string | null };

test('M5 flow — a customer confirms on Messenger, the AI creates the order, it appears live in /orders, is confirmed and printed (A5)', async ({ page }) => {
  await signIn(page, owner);
  await page.goto('/fr/orders');
  // the list is open (empty workspace) before the customer writes
  await expect(page.getByTestId('orders-empty').or(page.locator('table[aria-label]'))).toBeVisible({ timeout: 60_000 });

  const sender = nextSender();
  await inject(request(page), owner, { channelId: shop.facebook.id, sender, text: 'Bonjour, je veux la robe satin' });
  const conversation = await conversationOf(request(page), owner, sender);
  await waitAiMessages(request(page), owner, conversation.id, 1);
  await inject(request(page), owner, { channelId: shop.facebook.id, sender, text: 'Amina Belkacem, 0555 12 34 56, wilaya Alger' });
  await waitAiMessages(request(page), owner, conversation.id, 2);
  await inject(request(page), owner, { channelId: shop.facebook.id, sender, text: 'je confirme' });

  // the order created by the AI tool reaches the open list without a reload
  let order: OrderRow | undefined;
  await expect
    .poll(
      async () => {
        const r = await apiCall<OrderRow[]>(request(page), owner, 'GET', `/orders?source=ai&pageSize=25`);
        order = (r.data ?? []).find((o) => o.conversationId === conversation.id);
        return !!order;
      },
      { timeout: 90_000, message: 'AI order of the conversation (is the worker running?)' },
    )
    .toBe(true);
  const row = page.locator(`tr[data-row="${order!.id}"]`);
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect(row).toContainText(`#${order!.number}`);
  await expect(row.locator('[data-source="ai"]')).toBeVisible();
  // the AI told the customer its order number
  const ai = await waitAiMessages(request(page), owner, conversation.id, 3);
  expect(ai.some((m) => (m.text ?? '').includes(order!.number))).toBeTruthy();

  // open the order and confirm it through the dialog
  await row.click();
  await expectUrl(page, new RegExp(`/fr/orders/${order!.id}$`));
  await expect(page.getByTestId('client-block')).toBeVisible({ timeout: 60_000 });
  await expectNoA11yViolations(page);
  await page.getByTestId('call-confirm').click();
  const confirm = page.getByTestId('confirm-dialog');
  await expect(confirm).toHaveAttribute('data-step', 'review');
  if ((await page.getByTestId('confirm-address').count()) > 0) {
    // the AI gave the wilaya and an address but no commune: completed from the dialog (ORDER_ADDRESS_REQUIRED)
    await page.getByTestId('confirm-address').click();
    await expect(page.getByTestId('address-dialog')).toBeVisible();
    await page.locator('#ad-commune').click();
    await page.getByRole('option').first().click();
    await page.getByTestId('dialog-submit').click();
    await expect(confirm).toBeVisible();
  }
  await page.getByTestId('confirm-next').click();
  await expect(confirm).toHaveAttribute('data-step', 'call');
  await expect(page.getByRole('radio', { name: /Confirmée/ })).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('dialog-submit').click();
  await expect(page.getByTestId('confirm-result')).toContainText(`#${order!.number}`);
  await expect.poll(async () => (await getOrder(request(page), owner, order!.id)).status, { timeout: 30_000 }).toBe('confirmed');
  await page.keyboard.press('Escape');

  // A5 slip: the print preview shows the order, the client and the total
  await page.goto(`/fr/orders/${order!.id}/print`);
  const slip = page.getByTestId('print-preview');
  await expect(slip).toBeVisible({ timeout: 60_000 });
  await expect(slip).toContainText(order!.number);
  await expect(slip).toContainText('0555 12 34 56');
  await expect(page.getByTestId('print-now')).toBeEnabled();
  await expectNoA11yViolations(page);
});
