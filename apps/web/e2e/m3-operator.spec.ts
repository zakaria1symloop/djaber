// M3 — Operator view (01-nest-module-map §3.2): an Operator reads and answers the inbox and may block / report, but
// has no "Supprimer la conversation" (inbox.delete), no "Débloquer" (safety.manage) and no channel management
// (channels.manage): the controls are hidden or greyed with their reason, and the API refuses the calls as well.
import { expect, test } from '@playwright/test';
import { API, apiReady, authHeaders, createAccount, loginHome, type Account } from './support/m1';
import { verifyEmail } from './support/m3-channels';
import { blockConversation, connectFakePages, inboxReady, inject, inviteOperator, waitConversation, type E2eChannel, type E2eConversation } from './support/m3-inbox';

test.describe.configure({ mode: 'serial' });
let owner: Account;
let operator: Account;
let facebook: E2eChannel;
let open: E2eConversation;
let blocked: E2eConversation;

test.beforeAll(async ({ request }) => {
  test.skip(!(await apiReady(request)), 'API not reachable on :4010');
  owner = await createAccount(request, { prefix: 'opw', finishOnboarding: true });
  test.skip(!(await inboxReady(request, owner)), 'M3 inbox API not reachable (GET /conversations/counts)');
  await verifyEmail(request, owner);
  facebook = (await connectFakePages(request, owner)).find((c) => c.platform === 'facebook')!;
  await inject(request, owner, { channelId: facebook.id, sender: '0101', text: 'Bonjour, vous livrez à Sétif ?' });
  await inject(request, owner, { channelId: facebook.id, sender: '0102', text: 'spam spam spam' });
  open = await waitConversation(request, owner, 'Client 0101');
  blocked = await waitConversation(request, owner, 'Client 0102');
  await blockConversation(request, owner, blocked.id);
  operator = await inviteOperator(request, owner);
});

test('Operator in the inbox: reads, replies, may block and report — no delete, no unblock', async ({ page, request }) => {
  await loginHome(page, operator);
  await page.goto(`/fr/inbox/${open.id}`);
  const thread = page.getByTestId('thread');
  await expect(thread).toHaveAttribute('data-conversation', open.id);
  await expect(thread.locator('[data-message="customer"]')).toContainText('Bonjour, vous livrez à Sétif ?');
  await expect(thread.locator('[data-composer="ready"]')).toBeVisible();

  await thread.getByRole('button', { name: 'Actions', exact: true }).click();
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem', { name: 'Marquer traitée' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Bloquer ce client' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Signaler à Djaber' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Supprimer la conversation' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  // same rule on the row menu
  await page.locator(`[data-row="${open.id}"]`).hover();
  await page.locator(`[data-row="${open.id}"]`).getByRole('button', { name: /^Actions ·/ }).click();
  await expect(page.getByRole('menu').getByRole('menuitem', { name: 'Archiver' })).toBeVisible();
  await expect(page.getByRole('menu').getByRole('menuitem', { name: 'Supprimer la conversation' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  // a blocked customer: the banner has no "Débloquer", the menu neither
  await page.goto(`/fr/inbox/${blocked.id}?tab=blocked`);
  await expect(page.locator('[data-banner="blocked"]')).toContainText('Client bloqué');
  await expect(page.getByTestId('unblock')).toHaveCount(0);
  await expect(page.getByTestId('thread').locator('[data-composer="disabled"]')).toContainText('BLOQUÉ');
  await page.getByTestId('thread').getByRole('button', { name: 'Actions', exact: true }).click();
  await expect(page.getByRole('menu').getByRole('menuitem', { name: 'Signaler à Djaber' })).toBeVisible();
  await expect(page.getByRole('menu').getByRole('menuitem', { name: 'Débloquer' })).toHaveCount(0);
  await expect(page.getByRole('menu').getByRole('menuitem', { name: 'Supprimer la conversation' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  // the API refuses too
  const h = authHeaders(operator);
  expect((await request.delete(`${API}/conversations/${open.id}`, { headers: h })).status()).toBe(403);
  expect((await request.post(`${API}/conversations/${blocked.id}/unblock`, { headers: h, data: {} })).status()).toBe(403);
});

test('Operator on the connected pages: list and page are readable, nothing can be connected, paused or disconnected', async ({ page, request }) => {
  await loginHome(page, operator);
  await page.goto('/fr/channels');
  const card = page.locator(`[data-testid="channel-card"][data-channel="${facebook.id}"]`);
  await expect(card).toBeVisible();
  await expect(page.getByTestId('connect-facebook')).toHaveCount(0);
  await expect(page.getByTestId('connect-instagram')).toHaveCount(0);
  // the row menu keeps navigation; management items are absent or greyed with their reason
  await card.getByRole('button', { name: 'Actions', exact: true }).click();
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem').first()).toBeVisible();
  for (const name of [/Déconnecter/, /Mettre en pause/, /Reconnecter/, /Synchroniser/]) {
    const item = menu.getByRole('menuitem', { name });
    if (await item.count()) await expect(item.first()).toBeDisabled();
  }
  await page.keyboard.press('Escape');

  await page.goto(`/fr/channels/${facebook.id}`);
  await expect(page.getByRole('heading', { level: 1, name: facebook.name })).toBeVisible();
  await expect(page.getByTestId('disconnect-page')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Synchroniser l.historique/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mettre en pause' })).toHaveCount(0);

  const h = authHeaders(operator);
  expect((await request.delete(`${API}/channels/${facebook.id}`, { headers: h })).status()).toBe(403);
  expect((await request.patch(`${API}/channels/${facebook.id}`, { headers: h, data: { status: 'paused' } })).status()).toBe(403);
  expect((await request.get(`${API}/channels/connect/facebook`, { headers: h })).status()).toBe(403);
});
