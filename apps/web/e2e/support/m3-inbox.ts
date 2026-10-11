// Helpers of the M3 inbox spec. Everything goes through this repo's API with its fake Meta adapter (META_DRIVER=fake):
// pages are connected by following the URL of `GET /channels/connect/facebook` (it points back at our own callback) and
// customer messages arrive through the dev simulator `POST /dev/meta/inbound`, which signs a webhook delivery and feeds
// it to the real intake. Nothing leaves the machine. States the fake adapter cannot produce over HTTP (a revoked token,
// a closed 24 h window, every media type) are served by patching the real answers with `page.route`.
import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { clearRateLimits } from './global-setup';
import { API, authHeaders, mailLink, PASSWORD, uniqueEmail, waitForMail, type Account } from './m1';

type Json = Record<string, unknown>;
export type E2eChannel = { id: string; name: string; platform: 'facebook' | 'instagram'; status: string };
export type E2eConversation = { id: string; status: string; unreadCount: number; version: number; aiPaused: boolean; client: { name: string }; channel: { id: string }; lastMessagePreview: string; assignee: { id: string } | null };

const get = async <T>(request: APIRequestContext, a: Account, path: string): Promise<T> => {
  const res = await request.get(`${API}${path}`, { headers: authHeaders(a) });
  expect(res.ok(), `GET ${path}: ${await res.text()}`).toBeTruthy();
  return ((await res.json()) as { data: T }).data;
};

/** True when the M3 inbox endpoints and the dev simulator answer (the specs skip themselves otherwise, with the reason). */
export async function inboxReady(request: APIRequestContext, a: Account): Promise<boolean> {
  try {
    return (await request.get(`${API}/conversations/counts`, { headers: authHeaders(a), timeout: 5000 })).ok();
  } catch {
    return false;
  }
}

/** Connects the fake pages of this account (2 Facebook pages + 1 linked Instagram) without a browser. */
export async function connectFakePages(request: APIRequestContext, a: Account): Promise<E2eChannel[]> {
  const start = await get<{ url: string }>(request, a, '/channels/connect/facebook');
  // the only URL ever followed: our own API callback (asserted so that a misconfigured run can never reach Meta)
  expect(new URL(start.url).host, 'the fake adapter must return a local callback URL').toBe(new URL(API).host);
  const res = await request.get(start.url, { headers: { Accept: 'application/json' } });
  expect(res.ok(), await res.text()).toBeTruthy();
  return get<E2eChannel[]>(request, a, '/channels');
}

/** One inbound customer message through the dev simulator. `sender` = last 4 digits of the fake customer ("Client 0042"). */
export async function inject(request: APIRequestContext, a: Account, o: { channelId: string; text?: string; image?: boolean; sender?: string }) {
  const senderId = `70000000${(o.sender ?? '0001').padStart(4, '0')}`;
  const res = await request.post(`${API}/dev/meta/inbound`, { headers: authHeaders(a), data: { channelId: o.channelId, text: o.text, image: o.image, senderId } });
  expect(res.status(), `POST /dev/meta/inbound: ${await res.text()}`).toBe(200);
  return senderId;
}

export const listConversations = (request: APIRequestContext, a: Account, query = '') => get<E2eConversation[]>(request, a, `/conversations${query}`);
export const getConversation = (request: APIRequestContext, a: Account, id: string) => get<E2eConversation>(request, a, `/conversations/${id}`);

/** Waits until the intake has stored the conversation of a fake customer and returns it. */
export async function waitConversation(request: APIRequestContext, a: Account, name: string, timeoutMs = 15_000): Promise<E2eConversation> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const found = (await listConversations(request, a)).find((c) => c.client.name === name);
    if (found) return found;
    if (Date.now() > deadline) throw new Error(`conversation of ${name} not stored (is the worker running?)`);
    await new Promise((r) => setTimeout(r, 300));
  }
}

export async function patchConversation(request: APIRequestContext, a: Account, id: string, data: Json) {
  const { version } = await getConversation(request, a, id);
  const res = await request.patch(`${API}/conversations/${id}`, { headers: authHeaders(a), data: { ...data, version } });
  expect(res.ok(), await res.text()).toBeTruthy();
}

export async function reply(request: APIRequestContext, a: Account, id: string, text: string) {
  const res = await request.post(`${API}/conversations/${id}/messages`, { headers: { ...authHeaders(a), 'Idempotency-Key': randomUUID() }, data: { text } });
  expect(res.status(), await res.text()).toBeLessThan(300);
}

/** Rewrites the JSON of a real answer (`GET /conversations/:id`, its messages…) before the page reads it. */
export async function patchAnswer(page: Page, url: RegExp, fn: (data: any) => unknown, method = 'GET') {
  await page.route(url, async (route) => {
    if (route.request().method() !== method) return route.fallback();
    const res = await route.fetch();
    const json = (await res.json()) as { data: unknown };
    await route.fulfill({ response: res, json: { ...json, data: fn(json.data) } });
  });
}

const CORS = { 'access-control-allow-origin': 'http://localhost:3010', 'access-control-allow-credentials': 'true' };
/** Answers a write with an error envelope of the catalogue (the page must keep its content and show it in place). */
export async function failWith(page: Page, url: RegExp, method: string, status: number, code: string, message: string, details?: unknown) {
  await page.route(url, async (route) => {
    if (route.request().method() !== method) return route.fallback();
    await route.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify({ error: { code, message, params: {}, fields: {}, details: details ?? null, ref: 'e2e-ref' } }) });
  });
}

const at = (minAgo: number) => new Date(Date.now() - minAgo * 60_000).toISOString();
const PIXEL = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="100%" height="100%" fill="#1c1c1c"/></svg>')}`;
/** One message of every `Message.type` and author, in the shape of `MessageView` (AT-MSG-08, AT-MSG-05). */
export const everyMessageType = (conversationId: string) => {
  const base = { conversationId, authorUser: null, agent: null, text: null, attachments: [], transcript: null, transcriptStatus: null, payload: null, deliveryStatus: 'sent', error: null, aiRunId: null, customerReaction: null, containsBlockedWord: false, flags: [] };
  const agent = { id: 'a1', name: 'Vendeur Pro', status: 'active' };
  const nadia = { id: 'u-nadia', firstName: 'Nadia', lastName: 'Ferhat', avatarUrl: null };
  const inbound = { direction: 'in', author: 'customer' };
  return [
    { ...base, ...inbound, id: 't-text', type: 'text', text: 'سلام، الروب ساتان كاين؟', sentAt: at(60) },
    { ...base, ...inbound, id: 't-image', type: 'image', text: 'Ch7al hada ?', attachments: [{ type: 'image', url: PIXEL, mime: 'image/svg+xml', size: 1200 }], sentAt: at(58) },
    { ...base, ...inbound, id: 't-audio', type: 'audio', attachments: [{ type: 'audio', url: 'data:audio/mpeg;base64,AAAA', mime: 'audio/mpeg', size: 4000, durationSec: 40 }], transcript: 'est-ce que la robe existe', transcriptStatus: 'done', sentAt: at(56) },
    { ...base, ...inbound, id: 't-audio-pending', type: 'audio', attachments: [{ type: 'audio', url: 'data:audio/mpeg;base64,AAAA', mime: 'audio/mpeg', size: 4000, durationSec: 12 }], transcriptStatus: 'pending', sentAt: at(55) },
    { ...base, ...inbound, id: 't-audio-long', type: 'audio', attachments: [{ type: 'audio', url: 'data:audio/mpeg;base64,AAAA', mime: 'audio/mpeg', size: 4000, durationSec: 151 }], transcriptStatus: 'too_long', sentAt: at(54) },
    { ...base, ...inbound, id: 't-video', type: 'video', attachments: [{ type: 'video', url: 'data:video/mp4;base64,AAAA', mime: 'video/mp4', size: 9000 }], sentAt: at(52) },
    { ...base, ...inbound, id: 't-file', type: 'file', attachments: [{ type: 'file', url: 'data:application/pdf;base64,AAAA', mime: 'application/pdf', size: 245_760, name: 'facture.pdf' }], sentAt: at(50) },
    { ...base, ...inbound, id: 't-location', type: 'location', payload: { location: { lat: 36.15, lng: 5.69, label: 'El Eulma' } }, sentAt: at(48) },
    { ...base, ...inbound, id: 't-sticker', type: 'sticker', attachments: [{ type: 'sticker', url: PIXEL, mime: 'image/svg+xml', size: 800 }], sentAt: at(46) },
    { ...base, ...inbound, id: 't-postback', type: 'postback', payload: { postback: 'Voir le catalogue' }, sentAt: at(44) },
    { ...base, id: 't-cards', direction: 'out', author: 'ai', agent, type: 'product_cards', payload: { cards: [{ productId: 'p1', name: 'La Robe satin', price: 4900, imageUrl: null, variants: 'S · M · L' }, { productId: 'p2', name: 'Tunique brodée', price: 2200, imageUrl: null }] }, sentAt: at(42) },
    { ...base, id: 't-ai', direction: 'out', author: 'ai', agent, type: 'text', text: 'Voici ce que j’ai pour vous', sentAt: at(41) },
    { ...base, id: 't-human', direction: 'out', author: 'human', authorUser: nadia, type: 'text', text: 'Bonjour, c’est Nadia. Votre colis part demain.', sentAt: at(30) },
    { ...base, id: 't-system', direction: 'out', author: 'system', type: 'system', payload: { system: { kind: 'order_created', params: { number: '#CMD-1042' } } }, sentAt: at(28) },
    { ...base, id: 't-skipped', direction: 'out', author: 'ai', agent, type: 'text', text: 'Votre colis est en route.', deliveryStatus: 'skipped_window', sentAt: at(20) },
    { ...base, id: 't-failed', direction: 'out', author: 'human', authorUser: nadia, type: 'text', text: 'Votre commande est confirmée', deliveryStatus: 'failed', error: 'META_UNAVAILABLE', sentAt: at(10) },
  ];
};

/** Invites an Operator into the owner's workspace and registers them through the invitation of the dev mailbox. */
export async function inviteOperator(request: APIRequestContext, owner: Account, firstName = 'Omar'): Promise<Account> {
  const email = uniqueEmail('op');
  const before = Date.now() - 2_000;
  const inv = await request.post(`${API}/workspace/invitations`, { headers: authHeaders(owner), data: { email, role: 'operator' } });
  expect(inv.status(), `invite: ${await inv.text()}`).toBeLessThan(300);
  const token = mailLink(await waitForMail(email, /^workspace\/invitation$/, { after: before })).split('/').pop()!.split('?')[0]!;
  const register = () => request.post(`${API}/auth/register`, { data: { firstName, lastName: 'Haddad', email, password: PASSWORD, locale: 'fr', invitationToken: token } });
  let res = await register();
  if (res.status() === 429) {
    await clearRateLimits();
    res = await register();
  }
  expect(res.status(), `register operator: ${await res.text()}`).toBeLessThan(300);
  const { data } = (await res.json()) as { data: { accessToken: string } };
  return { email, password: PASSWORD, firstName, lastName: 'Haddad', accessToken: data.accessToken, workspaceId: owner.workspaceId };
}

export async function blockConversation(request: APIRequestContext, a: Account, id: string) {
  const res = await request.post(`${API}/conversations/${id}/block`, { headers: authHeaders(a), data: { reason: 'spam' } });
  expect(res.ok(), await res.text()).toBeTruthy();
}
