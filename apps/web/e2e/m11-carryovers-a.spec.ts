// M11 — web side of carry-overs closed by the API in M11 (docs/implementation/carry-overs.md):
//  - AGV-07 pause dialog checkbox "Envoyer le message « hors horaires »" (`POST /agents/:id/pause { sendOutOfHours }`);
//  - AGT-03 generation review edited before applying (`POST /agents/generate/:jobId/apply { override }`);
//  - product page "Agents qui le vendent" → `/agents?productId=` (removable chip);
//  - agent → inbox `?agentId=` (removable chip, `GET /conversations?agentId=`);
//  - WS typing: "Nadia F. écrit…" from another member, the composer's own `typing` signal, "IA répond…" around the AI reply.
// On the REAL API (fake Meta pages, deterministic fake AI, worker running). No `page.route`.
import { expect as baseExpect, test, type Page } from '@playwright/test';
import { io, type Socket } from 'socket.io-client';
import { API, apiReady, expectUrl, loginHome, type Account } from './support/m1';
import { activeAgent, customerSays, inject, listAgents, messagesOf, nextSender, realGet, realPost, refreshToken, resumeAgent, setupShop, type RealAgent, type Shop } from './support/m4-real';
import { bodyOf, clearGenerationLimits, fullAgent, inviteAdmin, questionAnswered, recordRequests, startGeneration, waitJob, type RealJob } from './support/m4-real-agent-page';

const expect = baseExpect.configure({ timeout: 20_000 });
test.describe.configure({ mode: 'serial', timeout: 240_000 });
test.use({ viewport: { width: 1440, height: 1000 } });

const POLL = { timeout: 30_000 };
const TAG = Date.now().toString(36).slice(-4);
type Generation = { proposedInstructions: string; proposedFaq: { q: string; a: string }[]; linkedAgent: { id: string } | null };
type Conversation = { id: string; status: string; aiPaused: boolean; channel: { id: string } };

let shop: Shop;
let owner: Account;
let agent: RealAgent;
let done: RealJob & { result: Generation };
/** a thread the agent answers (facebook) and one on the page without agent (facebook2) */
let answered: Conversation;
let answeredSender = '';
let unanswered: Conversation;

test.beforeAll(async ({ request }) => {
  test.skip(!(await apiReady(request)), 'API not reachable on :4010');
  test.setTimeout(300_000);
  shop = await setupShop(request, 'm11ca');
  owner = shop.owner;
  for (const [question, answer] of [
    ['Vous livrez à Sétif ?', 'Oui, en 48 h, 600 DA.'],
    ['Kayen taille L ?', 'Oui, du S au XL.'],
  ] as const)
    await questionAnswered(request, owner, { channelId: shop.facebook.id, sender: nextSender(), question, answer });
  agent = await activeAgent(request, owner, { name: `Vendeur ${TAG}`, channelId: shop.facebook.id });
  await clearGenerationLimits(owner.workspaceId, [shop.facebook.id]);
  done = (await waitJob(request, owner, (await startGeneration(request, owner, shop.facebook.id)).jobId)) as typeof done;
  expect(done.status).toBe('done');
  expect(done.result.proposedFaq.length).toBeGreaterThanOrEqual(2);
  answeredSender = nextSender();
  answered = (await customerSays(request, owner, { channelId: shop.facebook.id, sender: answeredSender, text: 'salam' })).conversation as unknown as Conversation;
  unanswered = (await customerSays(request, owner, { channelId: shop.facebook2.id, sender: nextSender(), text: 'bonjour' }, 0)).conversation as unknown as Conversation;
});

/* ---------- AGT-03: the review is editable before applying ---------- */
test('AT-AGT-03 review edited before applying: instructions, a removed FAQ row and a policy are sent as `override` and land on the new draft', async ({ page, request }) => {
  await loginHome(page, owner);
  await page.goto(`/fr/agents/generate?channel=${shop.facebook.id}&job=${done.id}`);
  const root = page.getByTestId('generate-agent');
  await expect(root).toHaveAttribute('data-phase', 'review', POLL);
  const instructions = page.getByTestId('generate-instructions');
  await expect(instructions).toHaveValue(done.result.proposedInstructions);
  const rows = page.getByTestId('generate-faq-row');
  await expect(rows).toHaveCount(done.result.proposedFaq.length);
  await expect(page.getByTestId('generate-review-editor')).toHaveAttribute('data-edited', 'false');

  const edited = `Instructions revues ${TAG}\n- Toujours vouvoyer.`;
  await instructions.fill(edited);
  await rows.first().getByTestId('generate-faq-remove').click();
  await page.getByLabel('PAIEMENT').fill('Paiement à la livraison uniquement.');
  await expect(page.getByTestId('generate-review-edited')).toHaveText('Proposition modifiée : vos changements seront appliqués.');
  const kept = done.result.proposedFaq.slice(1).map((f) => ({ q: f.q.trim(), a: f.a.trim() }));

  const applies = recordRequests(page, 'POST', new RegExp(`/agents/generate/${done.id}/apply$`));
  await page.getByTestId('generate-apply-new').click();
  await expectUrl(page, /\/fr\/agents\/new\/knowledge\?draft=[0-9a-f-]{36}$/, { timeout: 90_000 });
  const body = bodyOf(applies[0]!) as { override?: { instructions?: string; faq?: unknown; policies?: Record<string, string> } };
  expect(body.override?.instructions).toBe(edited);
  expect(body.override?.faq).toEqual(kept);
  expect(body.override?.policies).toMatchObject({ payment: 'Paiement à la livraison uniquement.' });
  const draftId = new URL(page.url()).searchParams.get('draft')!;
  const draft = await fullAgent(request, owner, draftId);
  expect(draft.customInstructions).toContain(`Instructions revues ${TAG}`);
  expect((await realGet<{ question: string }[]>(request, owner, `/agents/${draftId}/faq`)).map((f) => f.question).sort()).toEqual(kept.map((f) => f.q).sort());
});

test('AT-AGT-03 a FAQ row with a question but no answer blocks the apply inline; "Revenir à la proposition" restores it', async ({ page }) => {
  await loginHome(page, owner);
  await page.goto(`/fr/agents/generate?channel=${shop.facebook.id}&job=${done.id}`);
  await expect(page.getByTestId('generate-agent')).toHaveAttribute('data-phase', 'review', POLL);
  await page.getByTestId('generate-faq-add').click();
  const rows = page.getByTestId('generate-faq-row');
  await expect(rows).toHaveCount(done.result.proposedFaq.length + 1);
  await rows.last().getByRole('textbox', { name: `Question ${done.result.proposedFaq.length + 1}` }).fill('Question sans réponse ?');
  const applies = recordRequests(page, 'POST', new RegExp(`/agents/generate/${done.id}/apply$`));
  await page.getByTestId('generate-apply-new').click();
  await expect(page.getByTestId('generate-error')).toHaveText('Chaque question gardée doit avoir sa réponse (ou retirez la ligne).');
  expect(applies).toHaveLength(0);
  await page.getByTestId('generate-review-reset').click();
  await expect(rows).toHaveCount(done.result.proposedFaq.length);
  await expect(page.getByTestId('generate-review-editor')).toHaveAttribute('data-edited', 'false');
});

/* ---------- product page → agents list filtered by the product ---------- */
test('product page "Voir dans Agents IA" → /agents?productId= lists the agents that sell it; the chip removes the filter', async ({ page, request }) => {
  const product = shop.products[0]!;
  // the agent sells it (the preset may already sell the whole catalogue: added only when missing)
  if (!(await listAgents(request, owner, `?productId=${product.id}`)).some((a) => a.id === agent.id)) await realPost(request, owner, '/products/bulk/agent', { ids: [product.id], agentId: agent.id });
  const selling = (await listAgents(request, owner, `?productId=${product.id}`)).map((a) => a.id).sort();
  expect(selling).toContain(agent.id);

  await loginHome(page, owner);
  await page.goto(`/fr/products/${product.id}`);
  const link = page.getByTestId('agents-of-product');
  await expect(link).toHaveText('Voir dans Agents IA');
  await expect(link).toHaveAttribute('href', `/fr/agents?productId=${product.id}`);
  await link.click();
  await expectUrl(page, `**/fr/agents?productId=${product.id}`);
  const chip = page.getByRole('list', { name: 'Filtres' }).getByRole('listitem').filter({ hasText: product.name });
  await expect(chip).toContainText(`Produit : ${product.name}`);
  await expect.poll(async () => (await page.locator('[data-agent]').evaluateAll((els) => els.map((e) => e.getAttribute('data-agent')!))).sort(), POLL).toEqual(selling);
  await chip.getByRole('button', { name: `Retirer le filtre Produit : ${product.name}` }).click();
  await expect(page).not.toHaveURL(/productId=/);
});

/* ---------- agent → inbox filtered by the agent ---------- */
test('inbox ?agentId=: chip with the agent name, only its conversations; removing the chip shows every conversation', async ({ page, request }) => {
  const ofAgent = (await realGet<Conversation[]>(request, owner, `/conversations?agentId=${agent.id}`)).map((c) => c.id);
  expect(ofAgent).toContain(answered.id);
  expect(ofAgent).not.toContain(unanswered.id);

  await loginHome(page, owner);
  await page.goto(`/fr/agents/${agent.id}`);
  await page.getByTestId('agent-tab-conversations').click();
  await expectUrl(page, `**/fr/inbox?agentId=${agent.id}`);
  const chip = page.getByTestId('inbox-agent-filter');
  await expect(chip).toContainText(`Agent : ${agent.name}`);
  const list = page.getByTestId('conversation-list');
  await expect(list.locator(`[data-row="${answered.id}"]`)).toBeVisible(POLL);
  await expect(list.locator(`[data-row="${unanswered.id}"]`)).toHaveCount(0);
  // the filter follows the thread links
  await list.locator(`[data-row="${answered.id}"] a`).first().click();
  await expectUrl(page, `**/fr/inbox/${answered.id}?agentId=${agent.id}`);
  await chip.getByRole('button', { name: `Retirer le filtre Agent : ${agent.name}` }).click();
  await expect(page).not.toHaveURL(/agentId=/);
  await expect(list.locator(`[data-row="${unanswered.id}"]`)).toBeVisible(POLL);
});

/* ---------- WS typing ---------- */
const wsOrigin = () => new URL(API).origin;
function memberSocket(a: Account): Promise<Socket> {
  const socket = io(`${wsOrigin()}/ws`, { auth: { token: a.accessToken }, transports: ['websocket'], reconnection: false });
  return new Promise((ok, ko) => {
    socket.once('connect', () => ok(socket));
    socket.once('connect_error', (e) => ko(e));
  });
}

test('typing: another member typing shows "Nadia F. écrit…"; the composer sends `typing { conversationId }` to the others', async ({ page, request }) => {
  const nadia = await inviteAdmin(request, owner, 'Nadia', 'Ferhat');
  await refreshToken(request, nadia); // a token issued for the workspace (room ws:<id>)
  const socket = await memberSocket(nadia);
  try {
    const received: { conversationId: string; userId: string }[] = [];
    socket.on('conversation.typing', (p: { conversationId: string; userId: string; ai?: boolean }) => !p.ai && received.push(p));
    await loginHome(page, owner);
    await page.goto(`/fr/inbox/${answered.id}`);
    await expect(page.getByTestId('thread')).toBeVisible(POLL);
    // the owner's page socket is up once the thread is live; Nadia types (relayed by the server to the other sockets)
    await expect(async () => {
      socket.emit('typing', { conversationId: answered.id });
      await expect(page.getByTestId('thread-typing')).toHaveText('Nadia F. écrit…', { timeout: 2_500 });
    }).toPass({ timeout: 30_000 });
    // the indicator ends by itself a few seconds after the last signal
    await expect(page.getByTestId('thread-typing')).toHaveCount(0, { timeout: 15_000 });

    // the owner types: Nadia's socket receives the owner's signal (throttled: one per 3 s)
    await page.getByRole('textbox', { name: 'Votre réponse' }).pressSequentially('bonjour', { delay: 30 });
    await expect.poll(() => received.filter((r) => r.conversationId === answered.id).length, POLL).toBeGreaterThanOrEqual(1);
    expect(received.filter((r) => r.conversationId === answered.id).length).toBeLessThanOrEqual(2);
  } finally {
    socket.close();
  }
});

/** Records every text the typing indicators showed (they may last a fraction of a second with the fake AI). */
async function watchTyping(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __typing: string[] };
    w.__typing = [];
    const seen = () => document.querySelectorAll('[data-testid="thread-typing"], [data-typing="ai"]').forEach((el) => w.__typing.push(el.textContent ?? ''));
    new MutationObserver(seen).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
}

test('typing: "Vendeur … répond…" in the thread and "IA répond…" on the row while the AI reply job runs', async ({ page, request }) => {
  await loginHome(page, owner);
  await page.goto(`/fr/inbox/${answered.id}`);
  await expect(page.getByTestId('thread')).toBeVisible(POLL);
  await watchTyping(page);
  const before = (await messagesOf(request, owner, answered.id)).filter((m) => m.author === 'ai').length;
  await inject(request, owner, { channelId: shop.facebook.id, sender: answeredSender, text: 'chhal le prix de la robe satin ?' });
  await expect.poll(async () => (await messagesOf(request, owner, answered.id)).filter((m) => m.author === 'ai').length, { timeout: 60_000 }).toBeGreaterThan(before);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __typing: string[] }).__typing), POLL).toEqual(expect.arrayContaining([`${agent.name} répond…`, 'IA répond…']));
  // and it is gone once the reply is there
  await expect(page.getByTestId('thread-typing')).toHaveCount(0);
});

/* ---------- AGV-07: pause with the "hors horaires" message ---------- */
test('AT-AGV-08 pause dialog: "Envoyer le message « hors horaires »" is sent with the confirmation; the open thread moves to « À traiter » and gets the message once', async ({ page, request }) => {
  const systemBefore = (await messagesOf(request, owner, answered.id)).filter((m) => m.author === 'system').length;
  await loginHome(page, owner);
  await page.goto('/fr/agents');
  await page.locator(`[data-agent="${agent.id}"]`).getByRole('button', { name: 'Actions', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Mettre en pause' }).click();
  const dialog = page.getByRole('dialog', { name: `Mettre en pause « ${agent.name} »` });
  const box = dialog.getByRole('checkbox', { name: /Envoyer le message « hors horaires » aux clients qui écrivent/ });
  await expect(box).not.toBeChecked();
  await expect(dialog).toContainText('Le message système « hors horaires » est envoyé une fois à chaque conversation ouverte, qui passe « À traiter ».');
  await box.check();
  const pauses = recordRequests(page, 'POST', new RegExp(`/agents/${agent.id}/pause$`));
  await dialog.getByTestId('pause-agent-confirm').click();
  // open threads ⇒ 409 AGENT_PAUSED_WITH_OPEN_THREADS first, then the explicit confirmation
  await expect(dialog.getByTestId('pause-open-threads')).toBeVisible();
  await expect(box).toBeChecked();
  await dialog.getByRole('button', { name: 'Mettre en pause quand même' }).click();
  await expect(dialog).toHaveCount(0, POLL);
  expect(pauses.map(bodyOf)).toEqual([{ sendOutOfHours: true }, { confirm: true, sendOutOfHours: true }]);
  await expect.poll(async () => (await realGet<Conversation>(request, owner, `/conversations/${answered.id}`)).status, POLL).toBe('needs_human');
  await expect.poll(async () => (await messagesOf(request, owner, answered.id)).filter((m) => m.author === 'system').length, POLL).toBe(systemBefore + 1);
  await resumeAgent(request, owner, agent.id);
});
