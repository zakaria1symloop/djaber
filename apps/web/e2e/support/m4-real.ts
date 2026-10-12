// The real M4 backend for the e2e specs: this repo's API with its deterministic fake AI provider (AI_DRIVER=fake,
// `GET /dev/ai/help`) and its fake Meta adapter (META_DRIVER=fake). A spec builds the state it needs through the API
// (shop, pages, agents, insights produced by real customer messages, credits) and the page reads the real answers.
// `page.route` stays only for states the fake drivers cannot produce over HTTP; each use says why.
import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext } from '@playwright/test';
import { API, authHeaders, createAccount, type Account } from './m1';
import { seedProduct, sku } from './m2';
import { verifyEmail } from './m3-channels';
import { connectFakePages, type E2eChannel, type E2eConversation } from './m3-inbox';

type Json = Record<string, unknown>;

/** Access tokens live 15 min and a serial spec file can run longer: a 401 signs the account in again (token updated in place). */
export async function refreshToken(request: APIRequestContext, a: Account) {
  const res = await request.post(`${API}/auth/login`, { data: { email: a.email, password: a.password } });
  if (!res.ok()) throw new Error(`login ${a.email} → ${res.status()} ${await res.text()}`);
  a.accessToken = ((await res.json()) as { data: { accessToken: string } }).data.accessToken;
}

async function call<T>(request: APIRequestContext, a: Account, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, data?: Json, headers: Record<string, string> = {}): Promise<T> {
  const send = () => request.fetch(`${API}${path}`, { method, headers: { ...authHeaders(a), ...headers }, ...(data === undefined ? {} : { data }) });
  let res = await send();
  if (res.status() === 401) {
    await refreshToken(request, a);
    res = await send();
  }
  if (!res.ok()) throw new Error(`${method} ${path} → ${res.status()} ${await res.text()}`);
  if (res.status() === 204) return undefined as T;
  return ((await res.json()) as { data: T }).data;
}
export const realGet = <T>(request: APIRequestContext, a: Account, path: string) => call<T>(request, a, 'GET', path);
export const realPost = <T>(request: APIRequestContext, a: Account, path: string, data: Json = {}, headers: Record<string, string> = {}) => call<T>(request, a, 'POST', path, data, headers);
export const realPut = <T>(request: APIRequestContext, a: Account, path: string, data: Json = {}) => call<T>(request, a, 'PUT', path, data);
export const realDelete = (request: APIRequestContext, a: Account, path: string) => call<void>(request, a, 'DELETE', path);

/* ---------- shop ---------- */
export type RealAgent = { id: string; name: string; status: 'draft' | 'active' | 'paused'; pausedReason: string | null; version: number; currentVersion: number; wizardStep: number | null; pendingInsights: number; channels: { id: string; name: string }[]; customInstructions: string; wizard: Json };
export type Shop = {
  owner: Account;
  /** the two fake Facebook pages and the Instagram account linked to the first one */
  facebook: E2eChannel;
  facebook2: E2eChannel;
  instagram: E2eChannel;
  products: { id: string; name: string; price: number }[];
};

/** Every product name the fake AI can find with a price question ("chhal le prix de la robe satin ?"). */
export const CATALOGUE = [
  { name: 'Robe satin', price: 4900, stock: 7 },
  { name: 'Abaya noire brodée', price: 6900, stock: 12 },
  { name: 'Foulard soie', price: 2400, stock: 30 },
];

/**
 * An onboarded owner with a verified e-mail (connecting needs it), the fake pages connected and a small catalogue.
 * New workspaces start on the 14-day Pro trial (5 agents, 300 credits).
 */
export async function setupShop(request: APIRequestContext, prefix: string, o: { products?: boolean; pages?: boolean } = {}): Promise<Shop> {
  const owner = await createAccount(request, { prefix, finishOnboarding: true });
  let channels: E2eChannel[] = [];
  if (o.pages !== false) {
    await verifyEmail(request, owner);
    channels = await connectFakePages(request, owner);
  }
  const products = [];
  if (o.products !== false) for (const p of CATALOGUE) products.push({ ...(await seedProduct(request, owner, { ...p, sku: sku('E2E') })), price: p.price });
  const fb = channels.filter((c) => c.platform === 'facebook');
  return { owner, facebook: fb[0]!, facebook2: fb[1]!, instagram: channels.find((c) => c.platform === 'instagram')!, products };
}

/* ---------- agents ---------- */
export const getAgent = (request: APIRequestContext, a: Account, id: string) => realGet<RealAgent>(request, a, `/agents/${id}`);
export const listAgents = (request: APIRequestContext, a: Account, query = '') => realGet<RealAgent[]>(request, a, `/agents${query}`);

/** A draft from a preset (`vendeur-pro` by default) or from scratch. */
export const createAgent = (request: APIRequestContext, a: Account, o: { name: string; presetKey?: string; fromScratch?: boolean; description?: string; wizard?: Json }) =>
  realPost<RealAgent>(request, a, '/agents', { ...(o.fromScratch ? { fromScratch: true } : { presetKey: o.presetKey ?? 'vendeur-pro' }), name: o.name, ...(o.description ? { description: o.description } : {}), ...(o.wizard ? { wizard: o.wizard } : {}) });

/** `PATCH /agents/:id` with the current version. */
export async function patchAgent(request: APIRequestContext, a: Account, id: string, data: Json) {
  const { version } = await getAgent(request, a, id);
  return call<RealAgent>(request, a, 'PATCH', `/agents/${id}`, { ...data, version });
}

/** Links a page to an agent (`move` takes it from the agent it answers for), or unlinks it (`agentId: null`). */
export const linkPage = (request: APIRequestContext, a: Account, channelId: string, agentId: string | null, move = true) => realPut<Json>(request, a, `/channels/${channelId}/agent`, { agentId, ...(agentId ? { move } : {}) });
export const activateAgent = (request: APIRequestContext, a: Account, id: string) => realPost<RealAgent>(request, a, `/agents/${id}/activate`, {});
export const pauseAgent = (request: APIRequestContext, a: Account, id: string) => realPost<RealAgent>(request, a, `/agents/${id}/pause`, { confirm: true });
export const resumeAgent = (request: APIRequestContext, a: Account, id: string) => realPost<RealAgent>(request, a, `/agents/${id}/resume`, {});

/** A draft from the preset, linked to `channelId` and activated: the agent that answers the customers of that page. */
export async function activeAgent(request: APIRequestContext, a: Account, o: { name: string; channelId: string; presetKey?: string; wizard?: Json }): Promise<RealAgent> {
  const draft = await createAgent(request, a, { name: o.name, presetKey: o.presetKey, wizard: o.wizard });
  await linkPage(request, a, o.channelId, draft.id);
  return activateAgent(request, a, draft.id);
}

/* ---------- customer messages and what the AI did with them ---------- */
export type RealMessage = { id: string; author: string; direction: string; type: string; text: string | null; aiRunId: string | null; payload: Json | null; sentAt: string };

/** One inbound customer message through the dev simulator (`sender` = last 4 digits: "Client 0042"). */
export const inject = (request: APIRequestContext, a: Account, o: { channelId: string; sender: string; text?: string; image?: boolean; audio?: boolean }) =>
  realPost<{ mid: string }>(request, a, '/dev/meta/inbound', { channelId: o.channelId, text: o.text, image: o.image, audio: o.audio, senderId: `70000000${o.sender.padStart(4, '0')}` });
export const listConversations = (request: APIRequestContext, a: Account, query = '') => realGet<E2eConversation[]>(request, a, `/conversations${query}`);
export const messagesOf = async (request: APIRequestContext, a: Account, conversationId: string) => realGet<RealMessage[]>(request, a, `/conversations/${conversationId}/messages?limit=50`);

/** Waits until the intake stored the conversation of a fake customer ("Client 0042" for `sender: '0042'`). */
export async function conversationOf(request: APIRequestContext, a: Account, sender: string, timeoutMs = 30_000): Promise<E2eConversation> {
  const name = `Client ${sender.padStart(4, '0').slice(-4)}`;
  let found: E2eConversation | undefined;
  await expect
    .poll(async () => (found = (await listConversations(request, a)).find((c) => c.client.name === name)) !== undefined, { timeout: timeoutMs, message: `conversation of ${name} (is the worker running?)` })
    .toBe(true);
  return found!;
}

/** Waits for `count` AI messages in a conversation (the worker answers after the batching window). */
export async function waitAiMessages(request: APIRequestContext, a: Account, conversationId: string, count = 1, timeoutMs = 60_000): Promise<RealMessage[]> {
  let ai: RealMessage[] = [];
  await expect
    .poll(async () => (ai = (await messagesOf(request, a, conversationId)).filter((m) => m.author === 'ai')).length, { timeout: timeoutMs, message: `AI messages of ${conversationId} (is the worker running?)` })
    .toBeGreaterThanOrEqual(count);
  return ai;
}

/** A customer message on a page with an active agent, then the AI answer(s) it produced. */
export async function customerSays(request: APIRequestContext, a: Account, o: { channelId: string; sender: string; text?: string; image?: boolean }, expectAi = 1) {
  await inject(request, a, { channelId: o.channelId, sender: o.sender, text: o.text, image: o.image });
  const conversation = await conversationOf(request, a, o.sender);
  const ai = expectAi ? await waitAiMessages(request, a, conversation.id, expectAi) : [];
  return { conversation, ai };
}

/* ---------- insights (produced by real customer messages, `GET /dev/ai/help`) ---------- */
export type RealInsight = { id: string; type: string; status: string; customerMessage: string; conversationId: string | null; agent: { id: string; name: string } };
/** Messages that make the fake AI write one insight of each kind. `error` needs a blocked word (`blockWord`). */
export const INSIGHT_TRIGGERS = {
  unknown_topic: 'chhal le prix de l iphone ?',
  unclear: '??',
  handoff: 'je veux parler à un humain',
} as const;

export const insightsOf = (request: APIRequestContext, a: Account, query = '') => realGet<RealInsight[]>(request, a, `/agent-insights${query}`);
export async function waitInsights(request: APIRequestContext, a: Account, query: string, count: number, timeoutMs = 60_000): Promise<RealInsight[]> {
  let rows: RealInsight[] = [];
  await expect.poll(async () => (rows = await insightsOf(request, a, query)).length, { timeout: timeoutMs, message: `insights ${query}` }).toBeGreaterThanOrEqual(count);
  return rows;
}

/** A word the safety filter blocks in AI replies: an AI reply containing it is withheld and becomes an `error` insight. */
export const setBlockedWords = (request: APIRequestContext, a: Account, words: string[]) => realPut<Json>(request, a, '/safety/blocked-words', { words });

/* ---------- credits ---------- */
export type RealCredits = { plan: { used: number; limit: number; remaining: number }; packs: { remaining: number }; total: number; exhausted: boolean; negative: boolean };
export const creditsOf = (request: APIRequestContext, a: Account) => realGet<RealCredits>(request, a, '/credits');
/** `POST /dev/ai/credits { balance }` (fake AI only): 0 ⇒ the next customer message meets F-4 (credits exhausted). */
export const setCredits = (request: APIRequestContext, a: Account, balance: number) => realPost<RealCredits>(request, a, '/dev/ai/credits', { balance });

/* ---------- misc ---------- */
export const idem = () => ({ 'Idempotency-Key': randomUUID() });
/** Distinct fake customers per test ("Client 0412"…): senders are 4 digits. */
let senderSeq = Math.floor(Math.random() * 5000) + 1000;
export const nextSender = () => String(++senderSeq).slice(-4);
