// Helpers of `m4-agent-page.spec.ts` and `m4-public-test.spec.ts`: worlds of the mocked M4 backend (`support/m4.ts`)
// for the states the default fixtures do not hold, and readers of the writes the page sent.
import { expect, type Locator, type Page } from '@playwright/test';
import { fixtureChannel, fixtureChannelList, fixtureInsight, fixtureInsights, IDS, world, type World } from './m4';

type Json = Record<string, unknown>;

export const agentPath = (id: string, tab: '' | '/configuration' | '/insights' | '/playground' = '', query = '') => `/fr/agents/${id}${tab}${query}`;
/** an id no fixture holds: `GET /agents/:id` answers 404 */
export const UNKNOWN_AGENT = 'aaaaaaaa-0000-7000-8000-000000000999';
/** first answer of the default world (`fixtureTurn(1)`) */
export const FIRST_TURN_ID = 'aaaaaaaa-0000-7000-8000-000000000001';
export const insightId = (n: number) => `dddddddd-0000-7000-8000-${String(n).padStart(12, '0')}`;

/** 4 pending insights of "Vendeur Pro" + 1 resolved (FAQ) + 1 ignored: every tab of AGT-08 has a row. */
export const insightsWorld = (over: Partial<World> = {}): World =>
  world({
    insights: [
      ...fixtureInsights(),
      fixtureInsight(5, { status: 'resolved', resolution: 'faq', customerMessage: 'vous livrez à Oran ?', aiResponse: 'Je vérifie', detail: 'wilaya absente de la grille', occurrences: 4 }),
      fixtureInsight(6, { status: 'dismissed', resolution: 'ignored_30d', type: 'unclear', customerMessage: 'slm cv', aiResponse: 'Pouvez-vous préciser ?', detail: null, occurrences: 1 }),
    ],
    ...over,
  });

/** "Amel Cosmétiques" answers with "Service Client": linking it to "Vendeur Pro" asks to move it (AGT-05). */
export const channelsWorld = (): World => {
  const w = world();
  w.channels = fixtureChannelList().map((c) => (c.id === IDS.cosmetics ? fixtureChannel(IDS.cosmetics, 'Amel Cosmétiques', { platform: 'instagram', agent: { id: IDS.service, name: 'Service Client', status: 'paused' } }) : c));
  const vendeur = w.agents.find((a) => a.id === IDS.vendeur)!;
  vendeur.channels = vendeur.channels.filter((c) => c.id !== IDS.cosmetics);
  return w;
};

/** Bodies of the writes whose `METHOD /path` starts with `prefix`, in the order they were sent. */
export const bodiesOf = (w: World, prefix: string): Json[] =>
  w.writes
    .filter((x) => x === prefix || x.startsWith(`${prefix} `))
    .map((x) => {
      const raw = x.slice(prefix.length).trim();
      return raw ? (JSON.parse(raw) as Json) : {};
    });
/** Waits until `count` writes with that prefix were recorded, then returns their bodies. */
export async function waitBodies(w: World, prefix: string, count: number): Promise<Json[]> {
  await expect.poll(() => bodiesOf(w, prefix).length, { timeout: 15_000 }).toBeGreaterThanOrEqual(count);
  return bodiesOf(w, prefix);
}

export const toast = (page: Page, text: string | RegExp): Locator => page.locator('[data-toast]').filter({ hasText: text });

/**
 * Clicks until the expected effect shows: on the dev server a control can be painted before React attached its
 * handlers (the route was just compiled), and the first click is then lost.
 */
export async function clickUntil(target: Locator, effect: () => Promise<void>) {
  await expect(async () => {
    await target.click();
    await effect();
  }).toPass({ timeout: 20_000, intervals: [500, 1000, 2000] });
}

/** The composer of the playground (merchant tab and public page share it). */
export const composer = (page: Page) => page.getByRole('textbox', { name: 'Écrire comme un client… (darija, arabizi, français)' });
export async function say(page: Page, text: string) {
  await composer(page).fill(text);
  await expect(page.getByTestId('playground-send')).toBeEnabled();
  await page.getByTestId('playground-send').click();
}

/**
 * Clicks a control whose effect is URL state (`router.replace` / a link) until the address matches (`want` = false:
 * until it no longer matches). On the shared dev server a transition can be dropped by a hot reload; the handlers
 * derive their next value from the URL, so a repeated click before the address changed asks for the same address.
 */
/**
 * A link to another route of the app: on the shared `next dev` server the route may compile on this first hit (tens of
 * seconds), so each click is given time to land before it is repeated.
 */
export async function clickForRoute(page: Page, target: Locator, pattern: RegExp) {
  await expect(async () => {
    if (!pattern.test(page.url())) await target.click({ timeout: 10_000 });
    await expect(page).toHaveURL(pattern, { timeout: 40_000 });
  }).toPass({ timeout: 150_000, intervals: [1000] });
}

export async function clickForUrl(page: Page, target: Locator, pattern: RegExp, want = true) {
  await expect(async () => {
    if (pattern.test(page.url()) !== want) await target.click();
    if (want) await expect(page).toHaveURL(pattern, { timeout: 4000 });
    else await expect(page).not.toHaveURL(pattern, { timeout: 4000 });
  }).toPass({ timeout: 60_000, intervals: [250, 500, 1000] });
}
