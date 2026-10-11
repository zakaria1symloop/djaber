// M3 — queue (QUEUE — File d'attente — items): empty state "Tout est calme" against the real API, then the cards and
// their actions. The fake Meta adapter cannot put a conversation in `needs_human` on demand from this spec, so the
// item tests serve `GET /conversations?status=needs_human` and `GET /agent-insights` from contract-shaped fixtures
// and check the requests the page sends (the end-to-end handoff flow is covered by m3-inbox with the inject route).
import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './support/a11y';
import { apiReady, createAccount, loginHome, type Account } from './support/m1';
import { conversationsReady, mockQueue, queueConversation } from './support/m3-misc';

test.describe.configure({ mode: 'serial' });
let account: Account;

test.beforeAll(async ({ request }) => {
  test.skip(!(await apiReady(request)), 'API not reachable on :4010');
  account = await createAccount(request, { prefix: 'queue', finishOnboarding: true });
});

test('QUEUE empty state on a new workspace: "Tout est calme", summary with the owner reminder, axe', async ({ page, request }) => {
  test.skip(!(await conversationsReady(request, account)), 'M3 conversations API (GET /conversations/counts) not reachable');
  await loginHome(page, account);
  await page.goto('/fr/queue');
  await expect(page.getByRole('heading', { name: "File d'attente", level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tout est calme' })).toBeVisible();
  await expect(page.getByText("Aucune conversation n'attend un humain. Les insights apparaissent ici.")).toBeVisible();
  await expect(page.getByTestId('queue-summary')).toContainText("Aucune conversation n'attend un humain");
  await expect(page.getByTestId('queue-summary')).toContainText('rappel propriétaire après 30 min');
  await expect(page.getByTestId('queue-reminder-settings')).toHaveAttribute('href', '/fr/settings/workspace');
  await expectNoA11yViolations(page);
});

test('QUEUE items: cards by reason with assignee, insight cards, "Répondre" opens the thread, axe', async ({ page }) => {
  const amina = queueConversation({ name: 'Amina Belkacem', preview: 'راني حابة نبدل القياس، حابتي صغيرة', handoffReason: 'rule:remboursement', minutes: 2 });
  const yacine = queueConversation({ name: 'Yacine Mansouri', preview: "wach kayen promo 3la had l'article ?", handoffReason: 'human_request', minutes: 11, assignee: { id: '0192f0a1-0000-7000-8000-00000000aaaa', firstName: 'Sara', lastName: 'Kaci' } });
  const karim = queueConversation({ name: 'Karim Djebbar', channel: 'Amel Cosmétiques', preview: 'Je veux commander 2 Parfum Oud 50 ml', handoffReason: 'credits_exhausted', minutes: 60 });
  await mockQueue(page, {
    conversations: [amina, yacine, karim],
    insights: [
      { id: 'i1', type: 'unknown_topic', agent: { id: 'a1', name: 'Vendeur Pro', status: 'active' }, conversationId: amina.id, client: { id: 'c', name: 'Nadia Ferhat' }, customerMessage: 'Vous faites aussi les retouches ?', aiResponse: null, detail: 'Sujet inconnu — conversation transférée', createdAt: new Date(Date.now() - 3_600_000).toISOString() },
    ],
  });
  await loginHome(page, account);
  await page.goto('/fr/queue');

  await expect(page.getByTestId('queue-summary')).toContainText('3 conversations attendent un humain · 1 problème signalé par les agents');
  const left = page.getByTestId('queue-conversations');
  await expect(left.locator('article')).toHaveCount(3);
  const first = left.locator(`article[data-conversation="${amina.id}"]`);
  await expect(first).toContainText('TRANSFERT · remboursement');
  await expect(first).toContainText('Amina B. · Boutique Amel');
  await expect(first).toContainText('راني حابة نبدل القياس');
  await expect(first).toContainText('Assignée : non assignée');
  const second = left.locator(`article[data-conversation="${yacine.id}"]`);
  await expect(second).toContainText('DEMANDE HUMAIN');
  await expect(second).toContainText('Assignée : Sara K.');
  await expect(left.locator(`article[data-conversation="${karim.id}"]`)).toContainText('CRÉDITS ÉPUISÉS');
  await expect(left.locator(`article[data-conversation="${karim.id}"]`)).toContainText('Karim D. · Amel Cosmétiques');

  const right = page.getByTestId('queue-insights');
  await expect(right.locator('article')).toHaveCount(1);
  await expect(right.locator('article')).toContainText('SUJET INCONNU');
  await expect(right.locator('article')).toContainText('« Vous faites aussi les retouches ? »');
  await expect(right.locator('article')).toContainText('Nadia F. · Vendeur Pro');
  await expectNoA11yViolations(page);

  await expect(first.locator('[data-action=reply]')).toHaveAttribute('href', `/fr/inbox/${amina.id}`);
});

test('QUEUE actions: "Me l\'assigner" and "Reprendre l\'IA" send the versioned PATCH; insights not served (404) leave the column empty', async ({ page }) => {
  const amina = queueConversation({ name: 'Amina Belkacem', preview: 'Je veux être remboursée', handoffReason: null, minutes: 5 });
  const patches: { id: string; body: Record<string, unknown> }[] = [];
  await mockQueue(page, { conversations: [amina], insights: null, onPatch: (id, body) => patches.push({ id, body }) });
  await loginHome(page, account);
  await page.goto('/fr/queue');
  const card = page.locator(`article[data-conversation="${amina.id}"]`);
  await expect(card).toContainText('TRANSFERT');
  await expect(page.getByTestId('queue-summary')).toContainText('1 conversation attend un humain · aucun problème signalé par les agents');
  await expect(page.getByTestId('queue-insights').locator('article')).toHaveCount(0);

  await card.locator('[data-action=assign]').click();
  await expect(page.getByText('Conversation avec Amina B. : assignée à vous')).toBeVisible();
  await card.locator('[data-action=resume]').click();
  await expect(page.getByText('IA reprise pour Amina B.')).toBeVisible();
  expect(patches).toHaveLength(2);
  expect(patches[0]!.id).toBe(amina.id);
  expect(patches[0]!.body.version).toBe(4);
  expect(typeof patches[0]!.body.assigneeId).toBe('string');
  expect(patches[1]!.body).toEqual({ aiPaused: false, status: 'active', version: 4 });
});

test('QUEUE at 390 px: one column, no horizontal overflow', async ({ page }) => {
  await mockQueue(page, { conversations: [queueConversation({ name: 'Amina Belkacem', preview: 'Bonjour', handoffReason: 'human_request', minutes: 3 })], insights: [] });
  await page.setViewportSize({ width: 390, height: 844 });
  await loginHome(page, account);
  await page.goto('/fr/queue');
  await expect(page.getByTestId('queue-conversations').locator('article')).toHaveCount(1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
