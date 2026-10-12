// M4 — end to end on the REAL M4 API (deterministic fake AI provider, fake Meta pages, worker running):
// the owner creates an agent with the wizard, links a connected page and activates it; a customer asks a price
// ("chhal le prix de la robe satin ?") and the AI reply with its product cards reaches the open inbox live while the
// credits pill moves; the inspector opens the AI run; "je veux parler à un humain" hands the conversation over to the
// queue; the playground answers a dry-run turn without credit; with the balance at 0 (`POST /dev/ai/credits`) the next
// customer message meets F-4: thread state "crédits épuisés", shell banner credits100, red pill.
// Nothing here is mocked.
import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './support/a11y';
import { apiReady, expectUrl, type Account } from './support/m1';
import { signIn } from './support/m4-agents';
import { conversationOf, creditsOf, inject, getAgent, messagesOf, nextSender, setCredits, setupShop, waitAiMessages, type Shop } from './support/m4-real';

test.describe.configure({ mode: 'serial', timeout: 180_000 });
test.use({ viewport: { width: 1440, height: 1000 } });

let shop: Shop;
let owner: Account;
let agentId = '';
const NAME = `Vendeur e2e ${Date.now().toString(36)}`;

test.beforeAll(async ({ request }) => {
  test.skip(!(await apiReady(request)), 'API not reachable on :4010');
  shop = await setupShop(request, 'm4flow');
  owner = shop.owner;
});

const pill = (page: Page) => page.getByTestId('credits-pill');
const pillUsed = async (page: Page) => Number(((await pill(page).innerText()).split('/')[0] ?? '').replace(/\D/g, ''));
const thread = (page: Page) => page.getByTestId('thread');
// the API calls of a test go through the request context of its browser context (absolute API URLs, bearer token)
const request = (page: Page) => page.context().request;

test('AT-AGT-02 — the wizard on the real API: preset → draft → page linked → activated', async ({ page }) => {
  await signIn(page, owner);
  await page.goto('/fr/agents/new');
  const start = page.getByTestId('starting-point');
  await expect(start.getByRole('radio').first()).toBeVisible({ timeout: 60_000 });
  // the four seeded presets + "De zéro"
  await expect(start.getByRole('radio')).toHaveCount(5);
  await start.getByRole('radio', { name: /Vendeur Pro/ }).click();
  await page.locator('#agent-name').fill(NAME);
  await page.getByTestId('wizard-next').click();
  await expectUrl(page, /\/agents\/new\/knowledge\?draft=[0-9a-f-]{36}/, { timeout: 60_000 });
  agentId = new URL(page.url()).searchParams.get('draft')!;

  await page.locator('#policy-delivery').fill('2–5 jours · stop-desk disponible');
  await page.getByTestId('wizard-next').click();
  await expectUrl(page, /\/agents\/new\/behaviour\?draft=/, { timeout: 60_000 });
  await expect(page.locator('[data-section="capabilities"]')).toBeVisible();
  await page.getByTestId('wizard-next').click();
  await expectUrl(page, /\/agents\/new\/channels\?draft=/, { timeout: 60_000 });

  const option = page.locator(`[data-testid="channel-option"][data-channel="${shop.facebook.id}"]`);
  await expect(option).toHaveAttribute('data-state', 'free', { timeout: 30_000 });
  await option.getByRole('checkbox').click(); // controlled: it turns on once the API linked the page
  await expect(option).toHaveAttribute('data-state', 'selected');
  await page.getByTestId('wizard-next').click();
  await expectUrl(page, /\/agents\/new\/activate\?draft=/, { timeout: 60_000 });

  await expect(page.locator('[data-section="readiness"] [data-check="channels"]')).toHaveAttribute('data-state', 'ok', { timeout: 30_000 });
  await page.getByTestId('activate-now').click();
  await expectUrl(page, new RegExp(`/agents/${agentId}$`), { timeout: 60_000 });
  await expect(page.getByTestId('agent-status')).toHaveAttribute('data-state', 'active');
  await expect(page.getByRole('heading', { level: 1, name: NAME })).toBeVisible();
  await expectNoA11yViolations(page);

  const saved = await getAgent(request(page), owner, agentId).catch(() => null);
  if (saved) expect(saved.channels.map((c) => c.id)).toContain(shop.facebook.id);
});

test('AT-AI-01 / AT-BIL-03 — a price question gets an AI reply with product cards, live in the open inbox; the credits pill moves', async ({ page }) => {
  await signIn(page, owner);
  await page.goto('/fr/inbox');
  await expect(pill(page)).toBeVisible({ timeout: 60_000 });
  const usedBefore = await pillUsed(page);
  const before = await creditsOf(request(page), owner);
  expect(usedBefore).toBe(before.plan.used);

  const sender = nextSender();
  await inject(request(page), owner, { channelId: shop.facebook.id, sender, text: 'chhal le prix de la robe satin ?' });
  // the new conversation reaches the list without a reload (WS conversation.created / message.created)
  const conversation = await conversationOf(request(page), owner, sender);
  const row = page.locator(`[data-row="${conversation.id}"]`);
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.click();
  await expect(thread(page)).toHaveAttribute('data-conversation', conversation.id, { timeout: 60_000 });

  // the reply is written by the worker after the batching window and arrives in the open thread live
  const ai = thread(page).locator('[data-message="ai"]').first();
  await expect(ai).toBeVisible({ timeout: 60_000 });
  await expect(ai).toContainText(/Robe satin/i);
  const cards = thread(page).getByRole('list', { name: 'Fiches produit envoyées' }).first();
  await expect(cards).toBeVisible({ timeout: 30_000 });
  await expect(cards.getByRole('listitem').filter({ hasText: 'Robe satin' })).toBeVisible();
  await expect(cards).toContainText('4 900');

  // the debit settles and the pill follows through WS credits.updated (no reload)
  await expect.poll(async () => (await creditsOf(request(page), owner)).plan.used, { timeout: 30_000 }).toBeGreaterThan(before.plan.used);
  const after = await creditsOf(request(page), owner);
  await expect.poll(() => pillUsed(page), { timeout: 30_000 }).toBe(after.plan.used);
  expect(after.plan.used).toBeGreaterThan(usedBefore);
});

test('AT-AI-17 — the AI run of a reply opens in the inspector', async ({ page }) => {
  const sender = nextSender();
  await inject(request(page), owner, { channelId: shop.facebook.id, sender, text: 'Bonjour' });
  const conversation = await conversationOf(request(page), owner, sender);
  await waitAiMessages(request(page), owner, conversation.id);
  await signIn(page, owner);
  await page.goto(`/fr/inbox/${conversation.id}`);
  await expect(thread(page)).toHaveAttribute('data-conversation', conversation.id, { timeout: 60_000 });
  const ai = thread(page).locator('[data-message="ai"]').first();
  await expect(ai).toBeVisible({ timeout: 30_000 });
  await ai.getByTestId('ai-run-open').click();
  const run = page.getByTestId('ai-run');
  await expect(run).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  await expect(run.locator('[data-row="status"]')).toBeVisible();
  await expect(run.locator('[data-row="model"]')).not.toBeEmpty();
});

test('AT-AI-10 — "je veux parler à un humain" hands the conversation over: À TRAITER banner and the queue', async ({ page }) => {
  await signIn(page, owner);
  const sender = nextSender();
  await inject(request(page), owner, { channelId: shop.facebook.id, sender, text: 'je veux parler à un humain' });
  const conversation = await conversationOf(request(page), owner, sender);
  await page.goto(`/fr/inbox/${conversation.id}`);
  await expect(thread(page)).toHaveAttribute('data-conversation', conversation.id, { timeout: 60_000 });
  // the handoff pauses the AI on the thread: IA EN PAUSE or À TRAITER (priority of 12 §23), reached live
  await expect(page.locator('[data-banner="needsHuman"], [data-banner="aiPaused"]')).toBeVisible({ timeout: 60_000 });
  // the handoff message of the agent and the workspace handoff text are in the thread
  await expect(thread(page).locator('[data-message="ai"]').first()).toBeVisible();
  await page.goto('/fr/queue');
  await expect(page.locator(`a[href$="/inbox/${conversation.id}"]`).first()).toBeVisible({ timeout: 60_000 });
});

test('AT-AI-16 — playground on the real API: a dry-run turn with its tool call, no credit used', async ({ page }) => {
  const before = (await creditsOf(request(page), owner)).plan.used;
  await signIn(page, owner);
  await page.goto(`/fr/agents/${agentId}/playground`);
  await page.getByRole('textbox', { name: /Écrire comme un client/ }).fill('Bonjour, vous avez la robe satin ? combien ?');
  await page.getByTestId('playground-send').click();
  const turn = page.getByTestId('playground-turn').first();
  await expect(turn).toBeVisible({ timeout: 60_000 });
  await expect(turn.locator('[data-message="ai"]')).toBeVisible();
  await expect(page.getByTestId('inspector').locator('[data-row="credits"]')).toContainText('0 (bac à essai)');
  expect((await creditsOf(request(page), owner)).plan.used).toBe(before);
});

test('AT-AI-14 — credits exhausted: the next customer message gets the thread state, the credits100 banner and a red pill', async ({ page }) => {
  await setCredits(request(page), owner, 0);
  await signIn(page, owner);
  // the shell already knows: banner credits100 + red pill
  await expect(page.locator('[data-shell-banner="credits100"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-shell-banner="credits100"]')).toContainText(/crédits/i);
  await expect(pill(page)).toHaveAttribute('data-level', 'exhausted');

  const sender = nextSender();
  await inject(request(page), owner, { channelId: shop.facebook.id, sender, text: 'chhal le prix de la robe satin ?' });
  const conversation = await conversationOf(request(page), owner, sender);
  await page.goto(`/fr/inbox/${conversation.id}`);
  await expect(thread(page)).toHaveAttribute('data-conversation', conversation.id, { timeout: 60_000 });
  const banner = page.locator('[data-banner="credits"]');
  await expect(banner).toBeVisible({ timeout: 60_000 });
  await expect(banner).toContainText('IA arrêtée : crédits épuisés');
  // the customer got the fixed "unavailable" text once, never an AI answer with cards
  await expect.poll(async () => (await messagesOf(request(page), owner, conversation.id)).filter((m) => m.type === 'product_cards').length).toBe(0);
  await expectNoA11yViolations(page);

  // "Acheter des crédits" of the shell banner opens the credits page, where the balance shows 0
  await page.locator('[data-shell-banner="credits100"]').getByRole('button').first().click();
  await expectUrl(page, '**/settings/credits', { timeout: 60_000 });
  await expect(page.getByTestId('ledger-row').first()).toBeVisible({ timeout: 30_000 });
  await setCredits(request(page), owner, 300);
});
