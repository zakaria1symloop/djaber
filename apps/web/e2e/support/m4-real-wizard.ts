// Helpers of `m4-wizard.spec.ts` and `m4-public-test.spec.ts` on the REAL M4 API (fake AI + fake Meta drivers): the
// reads and writes a spec needs to build its state (presets, FAQ, readiness, scenarios, test links, jobs) and a recorder
// of the writes the page sends. The recorder only observes (`page.on('request')`): nothing is answered in the API's
// place. The one-shot error answer `failOnce` is the only fixture here; each caller says why the API cannot produce it.
import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { API, type Account } from './m1';
import { idem, realDelete, realGet, realPost } from './m4-real';

type Json = Record<string, unknown>;

/* ---------- what the page sends ---------- */
export type Recorder = { writes: string[] };
/** Records every write the page sends to the API (`PATCH /agents/<id> {…}`), sign-in and token refresh excluded. */
export function recordWrites(page: Page): Recorder {
  const rec: Recorder = { writes: [] };
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (!url.pathname.startsWith('/api/v1/') || ['GET', 'HEAD', 'OPTIONS'].includes(r.method())) return;
    const path = url.pathname.replace('/api/v1', '');
    if (path.startsWith('/auth/')) return;
    rec.writes.push(`${r.method()} ${path} ${r.postData() ?? ''}`.trim());
  });
  return rec;
}
/** Writes that start with `prefix` ("PATCH /agents/<id>"). */
export const writesOf = (rec: Recorder, prefix: string): string[] => rec.writes.filter((x) => x === prefix || x.startsWith(`${prefix} `));
/** Writes of the M4 resources (agents, their FAQ, test links, the agent of a page). */
export const agentWrites = (rec: Recorder): string[] => rec.writes.filter((x) => /^\w+ \/(agents|channels\/[^/]+\/agent)/.test(x));
/** JSON body of a recorded write. */
export const bodyOf = (write: string): Json => {
  const i = write.indexOf('{');
  return i < 0 ? {} : (JSON.parse(write.slice(i)) as Json);
};
/** Waits until the page has sent `count` writes starting with `prefix`; returns them. */
export async function expectWrites(rec: Recorder, prefix: string, count = 1): Promise<string[]> {
  await expect.poll(() => writesOf(rec, prefix).length, { timeout: 30_000, message: `writes "${prefix}" — got:\n${rec.writes.join('\n')}` }).toBe(count);
  return writesOf(rec, prefix);
}

/**
 * Signs the browser in without the login screen: `POST /auth/login` through the request context of the page sets the
 * refresh cookie in the browser context, and the next page boots its session from it (refresh → me → workspace).
 * The shared dev server is then spared a render of Home per test (the sign-in screen itself is covered by M1).
 */
export async function signInApi(page: Page, a: Account) {
  const res = await page.context().request.post(`${API}/auth/login`, { data: { email: a.email, password: a.password } });
  expect(res.ok(), `login ${a.email}: ${await res.text()}`).toBeTruthy();
  a.accessToken = ((await res.json()) as { data: { accessToken: string } }).data.accessToken;
}

/**
 * Opens a page and waits for `ready`, repeating the navigation: on the shared `next dev` server a route can take
 * tens of seconds to compile and its first load can stay on the boot screen ("Chargement…") without its scripts.
 */
export async function enter(page: Page, url: string, ready: () => Locator) {
  await expect(async () => {
    await page.goto(url, { timeout: 90_000 });
    await expect(ready()).toBeVisible({ timeout: 45_000 });
  }).toPass({ timeout: 200_000, intervals: [1_000] });
}

/* ---------- reads and writes of the real API ---------- */
export type RealPreset = { key: string; name: string; tagline: string | null; imageRecognition: boolean; voiceTranscription: boolean; responseDelaySec: number; personality: string };
export const presetsOf = (request: APIRequestContext, a: Account) => realGet<RealPreset[]>(request, a, '/agents/presets');

export type RealFaq = { id: string; question: string; answer: string; source: string; askedCount: number | null; isActive: boolean };
export const faqsOf = (request: APIRequestContext, a: Account, agentId: string) => realGet<RealFaq[]>(request, a, `/agents/${agentId}/faq`);
export const addFaq = (request: APIRequestContext, a: Account, agentId: string, question: string, answer: string) => realPost<RealFaq>(request, a, `/agents/${agentId}/faq`, { question, answer });

export type RealCheck = { key: string; ok: boolean; label: string; count?: number; link?: string; blocking: boolean };
export const readinessOf = (request: APIRequestContext, a: Account, agentId: string) => realGet<{ ready: boolean; checks: RealCheck[] }>(request, a, `/agents/${agentId}/readiness`);

export type RealScenario = { scenarioKey: string; status: 'pass' | 'fail' | 'error' | null; summary: string | null };
export const scenariosOf = (request: APIRequestContext, a: Account, agentId: string) => realGet<RealScenario[]>(request, a, `/agents/${agentId}/test-scenarios`);

/** `POST /agents/:id/test-links` (24 h): the public URL and its token. */
export async function testLinkOf(request: APIRequestContext, a: Account, agentId: string) {
  const link = await realPost<{ url: string; expiresAt: string }>(request, a, `/agents/${agentId}/test-links`, {});
  return { ...link, token: new URL(link.url).pathname.split('/').pop()! };
}

export const deleteAgent = (request: APIRequestContext, a: Account, id: string) => realDelete(request, a, `/agents/${id}`);

/** Polls `GET /jobs/:id` until the job is over; returns it. */
export async function waitJob(request: APIRequestContext, a: Account, jobId: string, timeoutMs = 90_000) {
  let job: { status: string; error: unknown; result: unknown } = { status: 'queued', error: null, result: null };
  await expect
    .poll(async () => (job = await realGet<typeof job>(request, a, `/jobs/${jobId}`)).status, { timeout: timeoutMs, message: `job ${jobId} (is the worker running?)` })
    .toMatch(/^(done|failed|cancelled)$/);
  return job;
}

/** A human reply of the team in a conversation (sent through the fake Meta adapter). */
export const teamReplies = (request: APIRequestContext, a: Account, conversationId: string, text: string) => realPost<Json>(request, a, `/conversations/${conversationId}/messages`, { text }, idem());

/* ---------- fixtures (only for states the API cannot produce over HTTP) ---------- */
const CORS = { 'access-control-allow-origin': 'http://localhost:3010', 'access-control-allow-credentials': 'true' };
/** Answers the next `method` request(s) to `url` (`times`, 1 by default) with an error envelope of the catalogue; later requests reach the API. */
export async function failOnce(page: Page, url: RegExp, method: string, status: number, code: string, message: string, o: { params?: Json; details?: unknown; times?: number } = {}) {
  let used = 0;
  await page.route(url, async (route) => {
    if (used >= (o.times ?? 1) || route.request().method() !== method) return route.fallback();
    used++;
    await route.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify({ error: { code, message, params: o.params ?? {}, fields: {}, details: o.details ?? null, ref: 'e2e-ref' } }) });
  });
}
