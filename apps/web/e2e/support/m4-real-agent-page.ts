// Real-API helpers of `m4-agent-page.spec.ts` and `m4-generate.spec.ts` (on top of `./m4-real`): the reads of an agent
// the shared `RealAgent` type does not carry, versions / metrics / jobs, the page generation, a second admin of the
// workspace (the "colleague" of the conflict and already-resolved states), and the few `page.route` helpers that only
// patch or hold a real answer for the states the fake drivers cannot produce over HTTP.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { expect, type APIRequestContext, type Page, type Request } from '@playwright/test';
import { clearRateLimits } from './global-setup';
import { API, authHeaders, mailLink, PASSWORD, uniqueEmail, waitForMail, type Account } from './m1';
import { reply } from './m3-inbox';
import { conversationOf, inject, realGet, realPost } from './m4-real';

type Json = Record<string, unknown>;

/* ---------- reads ---------- */
export type FullAgent = {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused';
  pausedReason: string | null;
  version: number;
  currentVersion: number;
  customInstructions: string;
  pendingInsights: number;
  productCount: number;
  model: { id: string; label: string; provider: string };
  preset: { key: string; name: string; version: number; updateAvailable: number | null } | null;
  channels: { id: string; name: string; platform: string }[];
  wizard: { maxQtyPerOrder: number | null; handoffKeywords: string[] } & Json;
  metrics30d: { conversations: number; handledWithoutHuman: number; credits: number; avgLatencyMs: number; p95LatencyMs: number; orders: number };
};
export type RealVersion = { version: number; note: string | null; source: string; isCurrent: boolean; createdBy: { firstName: string; lastName: string } | null };
export type RealMetrics = FullAgent['metrics30d'] & { aiMessages: number; handoffs: number };
export type RealJob = { id: string; status: string; progress: number; result: Json | null; error: Json | null };

export const fullAgent = (request: APIRequestContext, a: Account, id: string) => realGet<FullAgent>(request, a, `/agents/${id}`);
export const versionsOf = (request: APIRequestContext, a: Account, id: string) => realGet<RealVersion[]>(request, a, `/agents/${id}/versions`);
export const metricsOf = (request: APIRequestContext, a: Account, id: string, from: string, to: string) => realGet<RealMetrics>(request, a, `/agents/${id}/metrics?from=${from}&to=${to}`);
export const resolveInsight = (request: APIRequestContext, a: Account, id: string, body: Json) => realPost<Json>(request, a, `/agent-insights/${id}/resolve`, body);

/** `from` / `to` (inclusive days of Africa/Algiers) of the last n days — the query the overview sends. */
export const lastDays = (days: number, now = new Date()) => {
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return { from: day(new Date(now.getTime() - (days - 1) * 86_400_000)), to: day(now) };
};

/* ---------- formatting of the fr screens (same rules as the app) ---------- */
/** "1 234" with the narrow no-break space of fr-FR, matched loosely */
export const num = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export const numRe = (n: number) => num(n).replace(/ /g, '\\s?');
/** "2,3 s" */
export const seconds = (ms: number) => `${(Math.round(ms / 100) / 10).toFixed(1).replace('.', ',')} s`;
/** "0,97" */
export const confidence = (c: number) => (Math.round(c * 100) / 100).toFixed(2).replace('.', ',');

/* ---------- a colleague (second admin of the workspace) ---------- */
export async function inviteAdmin(request: APIRequestContext, owner: Account, firstName = 'Nadia', lastName = 'Ferhat'): Promise<Account> {
  const email = uniqueEmail('adm');
  const before = Date.now() - 2_000;
  const inv = await request.post(`${API}/workspace/invitations`, { headers: authHeaders(owner), data: { email, role: 'admin' } });
  expect(inv.status(), `invite: ${await inv.text()}`).toBeLessThan(300);
  const token = mailLink(await waitForMail(email, /^workspace\/invitation$/, { after: before })).split('/').pop()!.split('?')[0]!;
  const register = () => request.post(`${API}/auth/register`, { data: { firstName, lastName, email, password: PASSWORD, locale: 'fr', invitationToken: token } });
  let res = await register();
  if (res.status() === 429) {
    await clearRateLimits();
    res = await register();
  }
  expect(res.status(), `register admin: ${await res.text()}`).toBeLessThan(300);
  const { data } = (await res.json()) as { data: { accessToken: string } };
  return { email, password: PASSWORD, firstName, lastName, accessToken: data.accessToken, workspaceId: owner.workspaceId };
}

/* ---------- page generation (AGT-03) ---------- */
/**
 * Generation is free but limited (1 / page / 24 h, 3 / day / workspace, Redis counters `rl:generation:<channel>` and
 * `rl:analysis:<workspace>:<day>`). A spec that starts several runs clears the counters of ITS workspace first —
 * the same local dev Redis the global setup already clears.
 */
export async function clearGenerationLimits(workspaceId: string | null, channelIds: string[]) {
  const require = createRequire(resolve(__dirname, '../../../api/package.json'));
  const Redis = require('ioredis');
  const redis = new Redis(process.env.E2E_REDIS_URL ?? 'redis://127.0.0.1:63799', { maxRetriesPerRequest: 2 });
  try {
    const keys: string[] = [...channelIds.map((id) => `rl:generation:${id}`), ...(workspaceId ? await redis.keys(`rl:analysis:${workspaceId}:*`) : [])];
    if (keys.length) await redis.del(...keys);
  } finally {
    await redis.quit();
  }
}

export const startGeneration = (request: APIRequestContext, a: Account, channelId: string, days = 30) => realPost<{ jobId: string }>(request, a, '/agents/generate', { channelId, days });
export async function waitJob(request: APIRequestContext, a: Account, jobId: string, timeoutMs = 60_000): Promise<RealJob> {
  let job: RealJob | undefined;
  await expect
    .poll(async () => (job = await realGet<RealJob>(request, a, `/jobs/${jobId}`)).status, { timeout: timeoutMs, message: `job ${jobId} (is the worker running?)` })
    .toMatch(/^(done|failed|partial|cancelled)$/);
  return job!;
}

/** A customer question on a page without agent, answered by a member as the page: what the generation reads. */
export async function questionAnswered(request: APIRequestContext, a: Account, o: { channelId: string; sender: string; question: string; answer: string }) {
  await inject(request, a, { channelId: o.channelId, sender: o.sender, text: o.question });
  const conversation = await conversationOf(request, a, o.sender);
  await reply(request, a, conversation.id, o.answer);
  return conversation;
}

/* ---------- route helpers (only for states the fake drivers cannot produce) ---------- */
const jobUrl = (jobId: string) => new RegExp(`/api/v1/jobs/${jobId}(\\?|$)`);
/** `null` = any job (the id of a job the page is about to start is not known yet) */
export const ANY_JOB = '[0-9a-f-]{36}';
/**
 * Holds the real answer of `GET /jobs/:id` as a job still running (`progress` %): the fake AI finishes a generation in
 * well under a second, so the running phase cannot be observed otherwise. Returns the release (the real answer again).
 */
export async function holdJobRunning(page: Page, jobId: string, progress: number): Promise<() => Promise<void>> {
  const url = jobUrl(jobId);
  await page.route(url, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const res = await route.fetch();
    const json = (await res.json()) as { data: Json };
    await route.fulfill({ response: res, json: { ...json, data: { ...json.data, status: 'running', progress, result: null, finishedAt: null } } });
  });
  return () => page.unroute(url);
}
/** The real job answer turned into a failed one (`error` = the error envelope of the job, or null). */
export async function failJob(page: Page, jobId: string, error: Json | null) {
  await page.route(jobUrl(jobId), async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const res = await route.fetch();
    const json = (await res.json()) as { data: Json };
    await route.fulfill({ response: res, json: { ...json, data: { ...json.data, status: 'failed', result: null, error } } });
  });
}

/** Records the requests the page sends (they still reach the real API): `METHOD path-regex`. */
export function recordRequests(page: Page, method: string, path: RegExp): Request[] {
  const seen: Request[] = [];
  page.on('request', (r) => {
    if (r.method() === method && path.test(new URL(r.url()).pathname)) seen.push(r);
  });
  return seen;
}
export const bodyOf = (r: Request) => (r.postDataJSON() ?? {}) as Json;

/**
 * A full page load (goto / reload) that waits for the boot refresh of the session (`POST /auth/refresh`, the access
 * token lives in memory). Navigating away while that rotation is in flight can lose its Set-Cookie: the next load
 * presents the rotated token again and the API revokes the whole session family (`AUTH_REFRESH_REUSED`).
 */
export async function load(page: Page, nav: () => Promise<unknown>) {
  const refreshed = page.waitForResponse((r) => r.url().endsWith('/api/v1/auth/refresh'), { timeout: 45_000 }).catch(() => null);
  await nav();
  await refreshed;
}
