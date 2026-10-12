// Extra helpers of `m4-agents.spec.ts` and `m4-wizard.spec.ts` (agents list + agent wizard) on top of the mocked M4
// backend of `./m4` (`world`, `mockAgents`).
import { expect, type Locator, type Page } from '@playwright/test';
import { expectUrl } from './m1';
import { agentActions, channelRef, IDS, world, type World } from './m4';

export const agentCard = (page: Page, id: string): Locator => page.locator(`[data-testid="agent-card"][data-agent="${id}"]`);
export const toastOf = (page: Page, text: string | RegExp): Locator => page.locator('[data-toast]').filter({ hasText: text });
/** The merchant sidebar (the wizard rail is an `<aside>` too). */
export const sidebar = (page: Page): Locator => page.getByRole('complementary').filter({ has: page.getByRole('link', { name: 'Djaber.ai' }) });
/** Row of the wizard summary rail by its mono label (MODÈLE, NOM, LANGUES…). */
export const railRow = (page: Page, label: string): Locator => page.getByTestId('summary-rail').locator(`[data-row="${label}"] dd`);
export const stepChip = (page: Page, step: string): Locator => page.locator(`li[data-step="${step}"]`);
export const wizardUrl = (step: string, id: string = IDS.draft) => `/fr/agents/new/${step}?draft=${id}`;

/** Writes recorded by the mock that start with `prefix` ("PATCH /agents/<id>"). */
export const writesOf = (w: World, prefix: string): string[] => w.writes.filter((x) => x === prefix || x.startsWith(`${prefix} `));
/** JSON body of a recorded write. */
export const bodyOf = (write: string): Record<string, unknown> => {
  const i = write.indexOf('{');
  return i < 0 ? {} : (JSON.parse(write.slice(i)) as Record<string, unknown>);
};
/** Waits until the page has sent `count` writes starting with `prefix`; returns them. */
export async function expectWrites(w: World, prefix: string, count = 1): Promise<string[]> {
  await expect.poll(() => writesOf(w, prefix).length, { timeout: 15_000, message: `writes "${prefix}" — got:\n${w.writes.join('\n')}` }).toBe(count);
  return writesOf(w, prefix);
}

/**
 * A world whose draft ("Réponse Express (brouillon)") reached step 4 and already answers on the free Instagram page:
 * the state the activation step needs (the server refuses `AGENT_NO_CHANNEL` otherwise).
 */
export const worldWithLinkedDraft = (over: Partial<World> = {}): World => {
  const w = world(over);
  const draft = w.agents.find((a) => a.id === IDS.draft)!;
  draft.channels = [channelRef(IDS.cosmetics, 'Amel Cosmétiques', 'instagram')];
  draft.wizardStep = 4;
  draft.actions = agentActions(draft);
  const page = w.channels.find((c) => c.id === IDS.cosmetics);
  if (page) page.agent = { id: draft.id, name: draft.name, status: draft.status };
  return w;
};

/** No horizontal scrolling of the document (RTL and small screens). */
export async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), { timeout: 5_000 }).toBeLessThanOrEqual(0);
}

/**
 * Opens a page of the app and waits for `ready`. The specs share one `next dev` server with other runs: a route
 * compiles on its first hit and a rebuild can leave a navigation without its scripts, so the navigation is repeated.
 */
export async function openPage(page: Page, url: string, ready: () => Locator) {
  await expect(async () => {
    await page.goto(url);
    await expect(ready()).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 100_000 });
}

/**
 * Signs in and waits for Home. The specs share one `next dev` server: Home can take a long time to compile after the
 * sign-in call (the URL then stays on the login page for a while), and the form can be clicked before it is hydrated
 * (the browser then submits it natively). The form is submitted again only while it is still there.
 */
export async function signIn(page: Page, a: { email: string; password: string }, locale = 'fr') {
  const home = new RegExp(`/${locale}/home$`);
  await page.goto(`/${locale}/login`);
  await expect(async () => {
    if (home.test(page.url())) return;
    if (await page.locator('#email').isVisible()) {
      await page.locator('#email').fill(a.email, { timeout: 5_000 });
      await page.locator('#password').fill(a.password, { timeout: 5_000 });
      await page.locator('form button[type=submit]').click({ timeout: 5_000 });
    }
    await expect(page).toHaveURL(home, { timeout: 30_000 });
  }).toPass({ timeout: 180_000 });
}

/** Slow first hits of the shared dev server: a client navigation commits only once the route is compiled. */
export const NAV = { timeout: 90_000 };
export const expectRoute = (page: Page, url: string | RegExp) => expectUrl(page, url, NAV);
