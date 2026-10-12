// Real-API helpers of `m4-channels.spec.ts` and `m4-carryovers.spec.ts` (on top of `./m4-real`): observing what the page
// sends (never answering it), patching a real answer while a switch is on (states the fake drivers cannot hold or
// produce over HTTP), reading the channel / analysis / products, and spending the 3 free analyses of the day.
import { expect, type APIRequestContext, type Locator, type Page, type Request } from '@playwright/test';
import type { Account } from './m1';
import { realGet, realPost } from './m4-real';

type Json = Record<string, unknown>;

/**
 * Signs in and waits for Home. Like `signIn` of `./m4-agents`, but every attempt reloads the login page: on the shared
 * `next dev` server a chunk can time out while a route recompiles (ChunkLoadError overlay) and only a new load clears it.
 */
export async function signInFresh(page: Page, a: { email: string; password: string }) {
  await expect(async () => {
    if (/\/fr\/home$/.test(page.url())) return;
    await page.goto('/fr/login');
    await page.locator('#email').fill(a.email, { timeout: 30_000 });
    await page.locator('#password').fill(a.password);
    await page.locator('form button[type=submit]').click();
    await expect(page).toHaveURL(/\/fr\/home$/, { timeout: 45_000 });
  }).toPass({ timeout: 200_000 });
}

/**
 * Opens a page and waits for `ready`, loading it again while it does not come (`openPage` of `./m4-agents` with more
 * room: the shared dev server recompiles under the load of the other spec files and a load can stay on its loader).
 */
export async function openFresh(page: Page, url: string, ready: () => Locator) {
  await expect(async () => {
    await page.goto(url);
    await expect(ready()).toBeVisible({ timeout: 45_000 });
  }).toPass({ timeout: 200_000 });
}

export const toast = (page: Page, text: string | RegExp) => page.locator('[data-toast]').filter({ hasText: text });

/** Records the JSON bodies of the requests the page sends to `url` with `method` (observation only, the API answers). */
export function observe(page: Page, method: string, url: RegExp): Json[] {
  const seen: Json[] = [];
  page.on('request', (r: Request) => {
    if (r.method() !== method || !url.test(r.url().split('?')[0]!)) return;
    try {
      seen.push((r.postDataJSON() as Json) ?? {});
    } catch {
      seen.push({});
    }
  });
  return seen;
}

/**
 * Rewrites the real answer of `GET url` while `sw.on` is true (the request still reaches the API). Turning the switch
 * off gives the page the real answer again.
 */
export async function patchWhile(page: Page, url: RegExp, fn: (data: any) => unknown, sw: { on: boolean } = { on: true }) {
  await page.route(url, async (route) => {
    if (route.request().method() !== 'GET' || !sw.on) return route.fallback();
    const res = await route.fetch();
    const json = (await res.json()) as { data: unknown };
    await route.fulfill({ response: res, json: { ...json, data: fn(json.data) } });
  });
  return sw;
}

export type RealChannel = { id: string; name: string; platform: string; status: string; icebreaker: string | null; agent: { id: string; name: string; status: string } | null };
export const channelOf = (request: APIRequestContext, a: Account, id: string) => realGet<RealChannel>(request, a, `/channels/${id}`);

export type RealAnalysisItem = { key: string; postId: string; name: string; price: number | null; category: string | null; duplicateOf: string | null };
export type RealAnalysis = { state: string; jobId: string | null; postsDone: number; postsTotal: number; items: RealAnalysisItem[]; runsLeftToday: number; startedAt: string | null; finishedAt: string | null };
export const analysisOf = (request: APIRequestContext, a: Account, channelId: string) => realGet<RealAnalysis>(request, a, `/channels/${channelId}/analysis`);
/** Waits until the analysis job of the page has finished (worker) and returns the review. */
export async function analysisDone(request: APIRequestContext, a: Account, channelId: string): Promise<RealAnalysis> {
  let last: RealAnalysis | null = null;
  await expect.poll(async () => (last = await analysisOf(request, a, channelId)).state, { timeout: 60_000, message: 'page analysis (is the worker running?)' }).toBe('done');
  return last!;
}

/** "Relancer (2 restantes aujourd’hui)" — the label of the rerun button for `n` runs left. */
export const rerunLabel = (n: number) => `Relancer (${n} ${n > 1 ? 'restantes' : 'restante'} aujourd’hui)`;

/**
 * Spends what is left of the 3 free analyses of the day (shared by page analysis, generation, FAQ extraction and
 * create-from-photo) with FAQ extractions until the API answers 429 `ANALYSIS_RATE_LIMITED`.
 */
export async function spendDailyRuns(request: APIRequestContext, a: Account, agentId: string, channelId: string) {
  for (let i = 0; i < 6; i++) {
    try {
      await realPost(request, a, `/agents/${agentId}/faq/extract`, { channelId });
    } catch (e) {
      if (String(e).includes('ANALYSIS_RATE_LIMITED')) return;
      throw e;
    }
  }
  throw new Error('the daily analysis limit was never reached');
}

export type RealProduct = { id: string; name: string; sku: string; price: number; stock: number | null; category: { name: string } | null };
export async function productsNamed(request: APIRequestContext, a: Account, q: string): Promise<RealProduct[]> {
  return (await realGet<RealProduct[]>(request, a, `/products?q=${encodeURIComponent(q)}&pageSize=50`)).filter((p) => p.name.includes(q));
}
