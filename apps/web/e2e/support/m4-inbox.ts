// Helpers of the M4 inbox / queue / catalogue carry-over specs. The conversations, messages and channels stay on the
// REAL API (fake Meta adapter); only the M4 answers the AI pipeline would produce are served here, by narrow routes:
// an AI message is a real outbound reply rewritten on its way to the page, the AI run and the insights of the thread
// come from the fixtures of `support/m4.ts`. `mockAgents` is not used on these screens: it would replace `/channels`.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { expect, type APIRequestContext, type Page, type Route } from '@playwright/test';
import { API, authHeaders, expectUrl, login, type Account } from './m1';
import { verifyEmail } from './m3-channels';
import { connectFakePages, inviteOperator, patchAnswer, type E2eChannel } from './m3-inbox';
import { fulfil } from './m3-misc';
import { fail, fixtureAgents, fixtureAiRun, type AgentFixture } from './m4';

type Json = Record<string, unknown>;
const CORS = { 'access-control-allow-origin': 'http://localhost:3010', 'access-control-allow-credentials': 'true' };
const preflight = (route: Route) => route.fulfill({ status: 204, headers: { ...CORS, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });

export const AI_AGENT = { id: 'aaaaaaaa-0000-7000-8000-000000000001', name: 'Vendeur Pro', status: 'active' };
export const AI_RUN_ID = 'eeeeeeee-0000-7000-8000-000000000005';
/** texts of the two seeded replies: the first one becomes an AI message with a run, the second an AI message without */
export const AI_TEXT = 'Oui, la robe satin est disponible en rouge, taille M.';
export const AI_TEXT_NO_RUN = 'Merci pour votre message, je regarde cela.';

/** `loginHome` with room for the shared dev server (a route compiles on its first hit, and again after any edit). */
export async function signIn(page: Page, a: Account) {
  await login(page, a);
  await expectUrl(page, '**/fr/home', { timeout: 90_000 });
}

/**
 * The fake pages of the account. An account kept between local runs (`E2E_REUSE=1`) has them already and its
 * verification link is spent: the e-mail is verified and the pages are connected only the first time.
 */
export async function fakePages(request: APIRequestContext, a: Account): Promise<E2eChannel[]> {
  const res = await request.get(`${API}/channels`, { headers: authHeaders(a) });
  const existing = res.ok() ? ((await res.json()) as { data: E2eChannel[] }).data : [];
  if (existing.some((c) => c.platform === 'facebook')) return existing;
  await verifyEmail(request, a);
  return connectFakePages(request, a);
}

type StoredMessage = { id: string; text: string | null; direction: string; author: string };
export async function listMessages(request: APIRequestContext, a: Account, conversationId: string): Promise<StoredMessage[]> {
  const res = await request.get(`${API}/conversations/${conversationId}/messages?limit=50`, { headers: authHeaders(a) });
  expect(res.ok(), await res.text()).toBeTruthy();
  return ((await res.json()) as { data: StoredMessage[] }).data;
}

/** The thread as the page reads it once the AI pipeline has answered: both seeded replies are AI messages of "Vendeur Pro". */
export async function asAiMessages(page: Page, conversationId: string) {
  await patchAnswer(page, new RegExp(`/api/v1/conversations/${conversationId}/messages(\\?.*)?$`), (rows: Json[]) =>
    rows.map((m) => (m.text === AI_TEXT || m.text === AI_TEXT_NO_RUN ? { ...m, author: 'ai', authorUser: null, agent: AI_AGENT, aiRunId: m.text === AI_TEXT ? AI_RUN_ID : null } : m)),
  );
}

/**
 * Conversation flags the AI pipeline sets (`creditsExhausted`, `aiUnavailable`, `needs_human` + `handoffReason`). The
 * member pause of an earlier manual reply is cleared first, so the banner under test is the one that decides.
 */
export async function withConversation(page: Page, conversationId: string, over: Json) {
  await patchAnswer(page, new RegExp(`/api/v1/conversations/${conversationId}$`), (c: Json) => ({ ...c, status: 'active', aiPaused: false, aiPausedBy: null, blocked: false, creditsExhausted: false, aiUnavailable: false, handoffReason: null, agent: AI_AGENT, ...over }));
}

/** `GET /messages/:id/ai-run`: the fixture run, or 404 when `run` is null. Resolves the ids that were asked. */
export async function mockAiRun(page: Page, run: Json | null = fixtureAiRun()) {
  const asked: string[] = [];
  await page.route(/\/api\/v1\/messages\/[^/]+\/ai-run$/, (route) => {
    if (route.request().method() === 'OPTIONS') return preflight(route);
    asked.push(route.request().url().split('/').slice(-2)[0]!);
    return run === null ? fail(route, 404, 'NOT_FOUND', 'Introuvable') : fulfil(route, run);
  });
  return asked;
}

export type InsightsMock = { rows: Json[]; queries: string[]; resolves: { id: string; body: Json }[]; failNext?: { status: number; code: string; message: string } };
/** `GET /agent-insights?conversationId=…` and `POST /agent-insights/:id/resolve` over an in-memory list. */
export async function mockInsights(page: Page, rows: Json[]): Promise<InsightsMock> {
  const m: InsightsMock = { rows, queries: [], resolves: [] };
  await page.route(/\/api\/v1\/agent-insights(\/|\?|$)/, (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return preflight(route);
    const url = new URL(req.url());
    const resolve = /\/agent-insights\/([^/]+)\/resolve$/.exec(url.pathname);
    if (resolve && req.method() === 'POST') {
      const body = req.postDataJSON() as Json;
      m.resolves.push({ id: resolve[1]!, body });
      if (m.failNext) {
        const f = m.failNext;
        m.failNext = undefined;
        // a colleague was faster: the server row is no longer pending
        if (f.code === 'INSIGHT_ALREADY_RESOLVED') Object.assign(m.rows.find((r) => r.id === resolve[1]) ?? {}, { status: 'resolved', resolution: 'instruction' });
        return fail(route, f.status, f.code, f.message);
      }
      const row = m.rows.find((r) => r.id === resolve[1]);
      if (row) Object.assign(row, { status: body.action === 'ignored_30d' ? 'dismissed' : 'resolved', resolution: body.action });
      return fulfil(route, row ?? null);
    }
    if (req.method() !== 'GET') return fail(route, 404, 'NOT_FOUND', 'Introuvable');
    m.queries.push(url.search);
    const conversationId = url.searchParams.get('conversationId');
    const status = url.searchParams.get('status');
    const found = m.rows.filter((r) => (!conversationId || r.conversationId === conversationId) && (!status || r.status === status));
    return fulfil(route, found, { page: 1, pageSize: 25, total: found.length });
  });
  return m;
}

export type CatalogAgentsMock = { agents: AgentFixture[]; bulk: Json[]; failNext?: { status: number; code: string; message: string }; /** ids answered `ok: false` (per-item result) */ refuse?: string[] };
/** `GET /agents` (picker and filter chips) and `POST /products/bulk/agent` — the products themselves stay real. */
export async function mockCatalogAgents(page: Page, agents: AgentFixture[] = fixtureAgents()): Promise<CatalogAgentsMock> {
  const m: CatalogAgentsMock = { agents, bulk: [] };
  await page.route(/\/api\/v1\/agents(\?.*)?$/, (route) => {
    if (route.request().method() === 'OPTIONS') return preflight(route);
    if (route.request().method() !== 'GET') return route.fallback();
    return fulfil(route, m.agents, { planLimit: { limit: 5, current: m.agents.filter((a) => a.status === 'active').length } });
  });
  await page.route(/\/api\/v1\/products\/bulk\/agent$/, (route) => {
    if (route.request().method() === 'OPTIONS') return preflight(route);
    const body = route.request().postDataJSON() as { ids: string[]; agentId: string };
    m.bulk.push(body);
    if (m.failNext) {
      const f = m.failNext;
      m.failNext = undefined;
      return fail(route, f.status, f.code, f.message);
    }
    const results = body.ids.map((id) => (m.refuse?.includes(id) ? { id, ok: false, error: { code: 'NOT_FOUND', message: 'Introuvable' } } : { id, ok: true }));
    return fulfil(route, { results }, { ok: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length });
  });
  return m;
}

/* ---------- accounts and seeds that survive local runs (`E2E_REUSE=1`) ---------- */
const ACCOUNTS_FILE = resolvePath(__dirname, '../../../../.local/e2e-accounts.json');
const savedAccounts = (): Record<string, Account> => {
  try {
    return JSON.parse(readFileSync(ACCOUNTS_FILE, 'utf8')) as Record<string, Account>;
  } catch {
    return {};
  }
};
/**
 * The Operator of a workspace. With `E2E_REUSE=1` the owner is kept between runs: its operator is kept as well (same
 * git-ignored file as `createAccount`), so repeated local runs do not add one member per run to the workspace.
 */
export async function operatorOf(request: APIRequestContext, owner: Account, key: string): Promise<Account> {
  const reuse = process.env.E2E_REUSE === '1';
  const saved = reuse ? savedAccounts()[key] : undefined;
  if (saved && saved.workspaceId === owner.workspaceId) {
    const res = await request.post(`${API}/auth/login`, { data: { email: saved.email, password: saved.password } });
    const token = res.ok() ? ((await res.json()) as { data: { accessToken?: string } }).data.accessToken : undefined;
    if (token) return { ...saved, accessToken: token };
  }
  const operator = await inviteOperator(request, await freshToken(request, owner));
  if (reuse) writeFileSync(ACCOUNTS_FILE, JSON.stringify({ ...savedAccounts(), [key]: { ...operator, accessToken: '' } }, null, 1));
  return operator;
}

/** A product of the real catalogue, created once per account (found again by its name on later local runs). */
export async function ensureProduct(request: APIRequestContext, a: Account, name: string, price: number): Promise<{ id: string; name: string }> {
  const res = await request.get(`${API}/products?q=${encodeURIComponent(name)}&pageSize=25`, { headers: authHeaders(a) });
  expect(res.ok(), await res.text()).toBeTruthy();
  const found = ((await res.json()) as { data: { id: string; name: string }[] }).data.find((p) => p.name === name);
  if (found) return found;
  const created = await request.post(`${API}/products`, { headers: authHeaders(a), data: { name, sku: `M4-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`, price, stock: 10 } });
  expect(created.status(), await created.text()).toBeLessThan(300);
  return ((await created.json()) as { data: { id: string; name: string } }).data;
}

/**
 * Access tokens live 15 minutes and a file may run longer on the shared dev server: signs the account in again when
 * its token is older than 8 minutes (the account object is updated in place).
 */
const tokenAt = new Map<string, number>();
export async function freshToken(request: APIRequestContext, a: Account): Promise<Account> {
  if (Date.now() - (tokenAt.get(a.email) ?? 0) < 8 * 60_000) return a;
  const res = await request.post(`${API}/auth/login`, { data: { email: a.email, password: a.password } });
  expect(res.ok(), `login ${a.email}: ${await res.text()}`).toBeTruthy();
  a.accessToken = ((await res.json()) as { data: { accessToken: string } }).data.accessToken;
  tokenAt.set(a.email, Date.now());
  return a;
}

export async function setOnboardingStep(request: APIRequestContext, a: Account, step: number) {
  await freshToken(request, a);
  const res = await request.patch(`${API}/workspace/onboarding`, { headers: authHeaders(a), data: { step } });
  expect(res.ok(), await res.text()).toBeTruthy();
}

/** A write answered by a planned list of outcomes, in order (the last one repeats); resolves the bodies received. */
export async function planned(page: Page, url: RegExp, method: string, answers: ((route: Route) => Promise<void> | void)[]) {
  const calls: string[] = [];
  await page.route(url, (route) => {
    if (route.request().method() === 'OPTIONS') return preflight(route);
    if (route.request().method() !== method) return route.fallback();
    calls.push(route.request().postData() ?? '');
    return answers[Math.min(answers.length - 1, calls.length - 1)]!(route);
  });
  return calls;
}
