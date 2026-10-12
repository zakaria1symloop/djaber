// Real-API helpers of `m4-agents.spec.ts` and `m4-operator.spec.ts` (agents list, agent page, Operator role), on top of
// `./m4-real` (shop, agents, customer messages through the fake Meta simulator, insights written by the fake AI).
import { expect, type APIRequestContext, type Page, type Request } from '@playwright/test';
import { API, authHeaders, type Account } from './m1';
import { patchAnswer } from './m3-inbox';
import {
  activateAgent,
  conversationOf,
  createAgent,
  getAgent,
  inject,
  insightsOf,
  linkPage,
  listAgents,
  nextSender,
  patchAgent,
  pauseAgent,
  refreshToken,
  setBlockedWords,
  type RealAgent,
  type RealInsight,
  type Shop,
} from './m4-real';

export type AgentRow = RealAgent & { model: { label: string } | null; currentVersion: number; actions: { key: string; enabled: boolean; reasonCode?: string }[] };
export type InsightRow = RealInsight & { aiResponse: string | null; detail: string | null; occurrences: number; channel: { id: string; name: string } | null };
type InsightType = 'unknown_topic' | 'unclear' | 'handoff' | 'error';

export const agentRow = (request: APIRequestContext, a: Account, id: string) => getAgent(request, a, id) as Promise<AgentRow>;

/** A paused agent: activation needs a page, so `channelId` is borrowed (moved to it, then given back to `returnTo`, or unlinked). */
export async function pausedAgent(request: APIRequestContext, a: Account, o: { name: string; presetKey?: string; description?: string; channelId: string; returnTo: string | null; keepPage?: boolean }): Promise<RealAgent> {
  const draft = await createAgent(request, a, { name: o.name, presetKey: o.presetKey, description: o.description });
  await linkPage(request, a, o.channelId, draft.id);
  await activateAgent(request, a, draft.id);
  const paused = await pauseAgent(request, a, draft.id);
  if (!o.keepPage) await linkPage(request, a, o.channelId, o.returnTo);
  return paused;
}

/** A call whose refusal is the point (403, 409…): status + body, the token renewed on 401. */
export async function rawCall(request: APIRequestContext, a: Account, method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, data?: Record<string, unknown>) {
  const send = () => request.fetch(`${API}${path}`, { method, headers: authHeaders(a), ...(data === undefined ? {} : { data }) });
  let res = await send();
  if (res.status() === 401) {
    await refreshToken(request, a);
    res = await send();
  }
  const text = await res.text();
  let body: { data?: any; error?: { code: string; params?: Record<string, unknown> } } = {};
  try {
    body = JSON.parse(text);
  } catch {
    /* 204 */
  }
  return { status: res.status(), body };
}

/** Deletes agents created by a test (cleanup: an agent already gone is fine). */
export async function dropAgents(request: APIRequestContext, a: Account, ids: (string | undefined)[]) {
  for (const id of ids) {
    if (!id) continue;
    let res = await request.delete(`${API}/agents/${id}`, { headers: authHeaders(a) });
    if (res.status() === 401) {
      await refreshToken(request, a);
      res = await request.delete(`${API}/agents/${id}`, { headers: authHeaders(a) });
    }
    expect([204, 404], await res.text()).toContain(res.status());
  }
}
export const agentByName = async (request: APIRequestContext, a: Account, name: string) => (await listAgents(request, a)).find((x) => x.name === name);

/**
 * One insight written by the fake AI for a real customer message on a page of an active agent (`GET /dev/ai/help`):
 * price question on a product outside the catalogue ⇒ `unknown_topic`; "??" / fewer than 3 letters ⇒ `unclear`;
 * "humain" ⇒ `handoff`; an AI reply containing a blocked word ⇒ `error` (the word is blocked for the time of the turn).
 */
export async function seedInsight(request: APIRequestContext, a: Account, channelId: string, type: InsightType, text: string, blockWord?: string): Promise<InsightRow> {
  if (blockWord) await setBlockedWords(request, a, [blockWord]);
  try {
    const sender = nextSender();
    await inject(request, a, { channelId, sender, text });
    const conversation = await conversationOf(request, a, sender);
    let found: InsightRow | undefined;
    await expect
      .poll(async () => (found = ((await insightsOf(request, a, `?conversationId=${conversation.id}`)) as InsightRow[]).find((i) => i.type === type))?.id ?? null, { timeout: 60_000, message: `${type} insight of "${text}" (is the worker running?)` })
      .not.toBeNull();
    return found!;
  } finally {
    if (blockWord) await setBlockedWords(request, a, []);
  }
}

/** Rewrites the agents of `GET /agents` (list + refetches) before the page reads them. */
export const patchAgentsList = (page: Page, fn: (a: AgentRow) => AgentRow) => patchAnswer(page, /\/api\/v1\/agents(\?.*)?$/, (rows: AgentRow[]) => rows.map(fn));

/** Writes (non-GET) the page sends to the API whose path matches `path`, with their JSON bodies. */
export function recordWrites(page: Page, path: RegExp) {
  const writes: { method: string; path: string; body: unknown }[] = [];
  page.on('request', (r: Request) => {
    const url = new URL(r.url());
    if (!url.pathname.startsWith('/api/v1/') || r.method() === 'GET' || r.method() === 'OPTIONS' || !path.test(url.pathname)) return;
    let body: unknown = null;
    try {
      body = r.postDataJSON();
    } catch {
      body = r.postData();
    }
    writes.push({ method: r.method(), path: url.pathname.replace('/api/v1', ''), body });
  });
  return writes;
}

/** The standard world of the agents list: 3 counted agents (active with 2 pages, paused without page, paused with a page) + 1 draft at step 2. */
export type AgentsWorld = { vendeur: RealAgent; service: RealAgent; conseiller: RealAgent; draft: RealAgent };
export async function agentsWorld(request: APIRequestContext, shop: Shop): Promise<AgentsWorld> {
  const owner = shop.owner;
  const draft0 = await createAgent(request, owner, { name: 'Vendeur Pro' });
  await linkPage(request, owner, shop.facebook.id, draft0.id);
  await linkPage(request, owner, shop.instagram.id, draft0.id);
  const vendeur = await activateAgent(request, owner, draft0.id);
  const service = await pausedAgent(request, owner, { name: 'Service Client', presetKey: 'service-client', description: 'Répond aux questions sur les délais, les retours et le suivi des colis.', channelId: shop.facebook2.id, returnTo: null });
  const conseiller = await pausedAgent(request, owner, { name: 'Conseiller Produit', presetKey: 'conseiller-produit', channelId: shop.facebook2.id, returnTo: null, keepPage: true });
  const d = await createAgent(request, owner, { name: 'Réponse Express (brouillon)', presetKey: 'reponse-express' });
  const draft = await patchAgent(request, owner, d.id, { step: 2 });
  return { vendeur, service, conseiller, draft };
}
