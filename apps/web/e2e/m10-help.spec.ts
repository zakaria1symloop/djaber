// M10 — merchant help center (Figma "HELP — Help & support (merchant)", 03 HELP-01…04): AT-HELP-01 (center, categories,
// guide reader, "?" panel, Arabic RTL), AT-HELP-02 (contact form: < 20 chars inline, auto-context, ticket created, Operator
// without "Facturation" + own tickets only, Admin+ every ticket), AT-HELP-03 (support answer ⇒ RÉPONSE REÇUE + e-mail,
// merchant reply ⇒ OUVERT, resolve ⇒ satisfaction ⇒ closed, TICKET_CLOSED). Real API on :4010 (fake drivers); the support
// side is driven through the admin API with a platform admin created in the dev database.
import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './support/a11y';
import { API, apiReady, authHeaders, createAccount, loginHome, waitForMail, type Account } from './support/m1';
import { inviteOperator } from './support/m3-inbox';
import { adminPost, createTicket, helpReady, platformAdmin, type Admin } from './support/m10-help';

test.describe.configure({ mode: 'serial' });
let owner: Account;
let admin: Admin;
const stamp = Date.now().toString(36);
const guide = { key: `e2e-guide-${stamp}`, title: `Reconnecter Instagram Zx${stamp}`, body: `# Pourquoi\nLe jeton Meta expire.\n\n- Ouvrez Pages connectées\n- Cliquez Reconnecter` };

test.beforeAll(async ({ request }) => {
  test.setTimeout(180_000);
  test.skip(!(await apiReady(request)), 'API not reachable on :4010');
  owner = await createAccount(request, { prefix: 'help', finishOnboarding: true });
  test.skip(!(await helpReady(request, owner)), 'M10 help API (GET /support/tickets) not reachable');
  admin = await platformAdmin(request, 'super_admin', 'help');
  // a published help guide of the "Pages & Instagram" category, attached to the orders page ("?" panel)
  const entry = await adminPost<{ id: string }>(request, admin, '/admin/cms', {
    key: guide.key,
    type: 'help',
    category: 'pages_instagram',
    target: { pages: ['orders'] },
    locales: { fr: { title: guide.title, body: guide.body }, ar: { title: `إعادة ربط Instagram ${stamp}`, body: 'الرمز انتهى.' }, en: { title: `Reconnect Instagram ${stamp}`, body: 'The token expired.' } },
  });
  await adminPost(request, admin, `/admin/cms/${entry.id}/publish`, {});
});

test('AT-HELP-01 "Aide" opens the center: 8 categories, guide reader in a side sheet, "?" panel of the current page, axe', async ({ page }) => {
  await loginHome(page, owner);
  await page.getByRole('link', { name: 'Aide', exact: true }).click();
  await expect(page).toHaveURL(/\/fr\/help$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Aide & support' })).toBeVisible();
  const cards = page.getByTestId('help-categories').getByRole('button');
  await expect(cards).toHaveCount(8);
  await expect(cards.first()).toContainText('Démarrer');
  await expect(page.getByTestId('service-status')).toContainText('État du service');
  await expectNoA11yViolations(page);

  // category filter in the URL, then the guide opens in the side sheet (?article=)
  await page.getByRole('button', { name: /Pages & Instagram/ }).click();
  await expect(page).toHaveURL(/category=pages_instagram/);
  await page.getByTestId('help-results').getByRole('button', { name: new RegExp(guide.title) }).click();
  await expect(page).toHaveURL(new RegExp(`article=${guide.key}`));
  const sheet = page.getByTestId('help-article');
  await expect(sheet).toContainText('Le jeton Meta expire.');
  await expect(sheet.getByRole('listitem')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(page).not.toHaveURL(/article=/);

  // search in the URL; no match ⇒ filtered empty with a way to contact support
  await page.goto(`/fr/help?q=Zx${stamp}`);
  await expect(page.getByTestId('help-results')).toContainText(guide.title);
  await page.goto('/fr/help?q=zzintrouvablezz');
  await expect(page.getByRole('heading', { name: 'Aucun guide trouvé' })).toBeVisible();

  // "?" in the top bar lists the guides of the current page
  await page.goto('/fr/orders');
  await page.getByTestId('help-panel-open').click();
  const panel = page.getByTestId('help-panel');
  await expect(panel).toHaveAttribute('data-context', 'orders');
  await panel.getByTestId('help-panel-guide').filter({ hasText: guide.title }).click();
  await expect(page.getByTestId('help-article')).toContainText('Le jeton Meta expire.');
});

test('AT-HELP-01 Arabic: the center is right-to-left with the Arabic guide', async ({ page }) => {
  await loginHome(page, owner, 'ar');
  await page.goto('/ar/help');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1, name: 'المساعدة والدعم' })).toBeVisible();
  await page.goto(`/ar/help?article=${guide.key}`);
  await expect(page.getByTestId('help-article')).toContainText('الرمز انتهى.');
});

let ticketId = '';
test('AT-HELP-02 contact form: < 20 characters inline (content kept), auto-context, suggestion, ticket created and listed', async ({ page }) => {
  await loginHome(page, owner);
  await page.goto('/fr/help/contact?from=%2Fsettings%2Fintegrations');
  const form = page.getByTestId('contact-form');
  await expect(form.locator('[data-context=page]')).toHaveValue('/settings/integrations');
  await expect(form.locator('[data-context=client]')).toHaveValue(/^web /);
  await form.getByTestId('ticket-category').selectOption('meta_connection');
  await form.getByTestId('ticket-message').fill('trop court');
  await form.getByTestId('ticket-submit').click();
  await expect(form.getByText('20 caractères minimum.')).toBeVisible();
  await expect(form.getByTestId('ticket-message')).toHaveValue('trop court');

  await form.getByTestId('ticket-message').fill(`Ma page Instagram demande de se reconnecter Zx${stamp} depuis ce matin.`);
  await expect(form.getByTestId('guide-suggestion')).toContainText(guide.title);
  await form.getByTestId('ticket-priority').selectOption('urgent');
  await form.getByTestId('ticket-submit').click();
  await expect(page).toHaveURL(/\/fr\/help\/tickets\/[0-9a-f-]{36}$/);
  ticketId = page.url().split('/').pop()!;
  const thread = page.getByTestId('ticket-thread');
  await expect(thread).toContainText(`Ma page Instagram demande de se reconnecter Zx${stamp}`);
  await expect(thread).toHaveAttribute('data-status', 'open');
  await expect(page.getByTestId('ticket-pill')).toHaveAttribute('data-pill', 'open');
  await expectNoA11yViolations(page);

  await page.goto('/fr/help');
  await expect(page.getByTestId('help-tickets-card').getByTestId('ticket-row').first()).toContainText('Ma page Instagram');
  await page.goto('/fr/help/tickets?status=resolved');
  await expect(page.getByRole('heading', { name: 'Aucun résultat' })).toBeVisible();
});

test('AT-HELP-02 Operator: no "Facturation" (API 403), sees only own tickets; Admin+ sees every ticket of the workspace', async ({ page, request, browser }) => {
  const operator = await inviteOperator(request, owner, 'Omar');
  const refused = await request.post(`${API}/support/tickets`, { headers: authHeaders(operator), data: { category: 'billing', priority: 'normal', message: 'Je voudrais une copie de ma facture du mois.' } });
  expect(refused.status()).toBe(403);
  const own = await createTicket(request, operator, { category: 'delivery', message: `Bordereau ZR Express illisible ${stamp} pour la commande.` });

  await loginHome(page, operator);
  await page.goto('/fr/help/contact');
  await expect(page.getByTestId('ticket-category').locator('option[value=delivery]')).toHaveCount(1);
  await expect(page.getByTestId('ticket-category').locator('option[value=billing]')).toHaveCount(0);
  await page.goto('/fr/help/tickets');
  await expect(page.getByRole('radiogroup', { name: 'Demandes affichées' })).toHaveCount(0);
  const rows = page.getByTestId('tickets-list').getByTestId('ticket-row');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(own.number);

  const ctx = await browser.newContext({ locale: 'fr-DZ', timezoneId: 'Africa/Algiers' });
  const ownerPage = await ctx.newPage();
  await loginHome(ownerPage, owner);
  await ownerPage.goto('/fr/help/tickets');
  await ownerPage.getByRole('radio', { name: "Toutes les demandes de l'espace" }).click();
  await expect(ownerPage).toHaveURL(/scope=workspace/);
  await expect(ownerPage.getByTestId('tickets-list')).toContainText(own.number);
  await ctx.close();
});

test('AT-HELP-03 support answer ⇒ RÉPONSE REÇUE + e-mail; merchant reply ⇒ OUVERT; resolve ⇒ rating closes; TICKET_CLOSED', async ({ page, request }) => {
  test.skip(!ticketId, 'needs the ticket of AT-HELP-02');
  const before = Date.now();
  await adminPost(request, admin, `/admin/support/tickets/${ticketId}/messages`, { body: 'Bonjour, reconnectez la page depuis Pages connectées › Reconnecter.', isInternal: false, waitCustomer: false });
  await adminPost(request, admin, `/admin/support/tickets/${ticketId}/messages`, { body: 'Note interne : jeton expiré', isInternal: true });
  // `support.reply` arrives in-app + e-mail (notification template, type support_reply)
  const mail = await waitForMail(owner.email, /^notification$/, { after: before });
  expect(mail.params.type).toBe('support_reply');

  await loginHome(page, owner);
  await page.goto(`/fr/help/tickets/${ticketId}`);
  await expect(page.getByTestId('ticket-pill')).toHaveAttribute('data-pill', 'answered');
  await expect(page.getByTestId('ticket-pill')).toHaveText('RÉPONSE REÇUE');
  const thread = page.getByTestId('ticket-thread');
  await expect(thread.locator('[data-author=support]')).toContainText('Pages connectées');
  await expect(thread).not.toContainText('Note interne');

  await page.getByTestId('ticket-reply-body').fill('Merci, c’est reconnecté.');
  await page.getByTestId('ticket-reply-send').click();
  await expect(thread.locator('[data-author=user]').last()).toContainText('c’est reconnecté');
  await expect(page.getByTestId('ticket-pill')).toHaveAttribute('data-pill', 'open');

  // "Envoyer & attendre le client" (default of an admin answer) ⇒ EN ATTENTE CLIENT on the merchant side
  await adminPost(request, admin, `/admin/support/tickets/${ticketId}/messages`, { body: 'Pouvez-vous confirmer que les commandes remontent ?', isInternal: false });
  await page.reload();
  await expect(page.getByTestId('ticket-pill')).toHaveAttribute('data-pill', 'pending_customer');
  await expect(page.getByTestId('ticket-pill')).toHaveText('EN ATTENTE CLIENT');

  await adminPost(request, admin, `/admin/support/tickets/${ticketId}/resolve`, {});
  await page.reload();
  await expect(page.getByTestId('ticket-pill')).toHaveAttribute('data-pill', 'resolved');
  const rate = page.getByTestId('ticket-rate');
  await rate.getByRole('radio', { name: '5 étoiles' }).click();
  await rate.getByTestId('ticket-rate-send').click();
  await expect(page.getByTestId('ticket-rated')).toContainText('note 5/5');
  await expect(page.getByTestId('ticket-pill')).toHaveAttribute('data-pill', 'closed');
  await expect(page.getByTestId('ticket-closed')).toHaveText('Demande clôturée : ouvrez-en une nouvelle.');

  const closed = await request.post(`${API}/support/tickets/${ticketId}/messages`, { headers: authHeaders(owner), data: { body: 'encore une question' } });
  expect(closed.status()).toBe(409);
  expect(((await closed.json()) as { error: { code: string } }).error.code).toBe('TICKET_CLOSED');
});
