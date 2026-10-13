// Helpers of the M4 e2e specs (agents, playground, insights, credits, page analysis).
// Two kinds of specs use them:
//  - UI specs: `mockAgents(page, world)` serves the M4 endpoints from contract-shaped fixtures (`@djaber/shared`
//    `schemas/agents.ts`) with a small in-memory state, so every state of a screen can be produced on demand
//    (plan limit, 409, rate limit, expired link…). Sign-in, workspace and everything else stay on the real API.
//  - flow specs: `agentsReady` + the seed helpers talk to the real M4 API (deterministic fake AI provider).
import type { APIRequestContext, Page, Route } from '@playwright/test';
import { API, authHeaders, type Account } from './m1';
import { fulfil } from './m3-misc';

type Json = Record<string, unknown>;
const CORS = { 'access-control-allow-origin': 'http://localhost:3010', 'access-control-allow-credentials': 'true' };
export const fail = (route: Route, status: number, code: string, message: string, params: Json = {}, details: unknown = null, headers: Record<string, string> = {}) =>
  route.fulfill({ status, contentType: 'application/json', headers: { ...CORS, 'access-control-expose-headers': 'retry-after', ...headers }, body: JSON.stringify({ error: { code, message, params, fields: {}, details, ref: 'req_e2e' } }) });
const at = (minAgo: number) => new Date(Date.now() - minAgo * 60_000).toISOString();
const uuid = (n: number, prefix = 'a') => `${prefix.repeat(8)}-0000-7000-8000-${String(n).padStart(12, '0')}`;

/* ---------- real API (flow specs) ---------- */
export async function agentsReady(request: APIRequestContext, a: Account): Promise<boolean> {
  try {
    return (await request.get(`${API}/agents/presets`, { headers: authHeaders(a), timeout: 5000 })).ok();
  } catch {
    return false;
  }
}
export async function creditsReady(request: APIRequestContext, a: Account): Promise<boolean> {
  try {
    return (await request.get(`${API}/credits`, { headers: authHeaders(a), timeout: 5000 })).ok();
  } catch {
    return false;
  }
}
export async function apiPost<T>(request: APIRequestContext, a: Account, path: string, data: Json = {}): Promise<T> {
  const res = await request.post(`${API}${path}`, { headers: authHeaders(a), data });
  if (!res.ok()) throw new Error(`POST ${path} → ${res.status()} ${await res.text()}`);
  return ((await res.json()) as { data: T }).data;
}
export async function apiGet<T>(request: APIRequestContext, a: Account, path: string): Promise<T> {
  const res = await request.get(`${API}${path}`, { headers: authHeaders(a) });
  if (!res.ok()) throw new Error(`GET ${path} → ${res.status()} ${await res.text()}`);
  return ((await res.json()) as { data: T }).data;
}
export async function apiPut<T>(request: APIRequestContext, a: Account, path: string, data: Json = {}): Promise<T> {
  const res = await request.put(`${API}${path}`, { headers: authHeaders(a), data });
  if (!res.ok()) throw new Error(`PUT ${path} → ${res.status()} ${await res.text()}`);
  return ((await res.json()) as { data: T }).data;
}

/* ---------- fixtures (api-contract §3.4 / shared read models) ---------- */
export const IDS = {
  vendeur: uuid(1),
  service: uuid(2),
  draft: uuid(3),
  planPaused: uuid(4),
  amel: '11111111-1111-7111-8111-111111111111',
  cosmetics: '22222222-2222-7222-8222-222222222222',
  outlet: '33333333-3333-7333-8333-333333333333',
};
const user = { id: uuid(9, 'b'), firstName: 'Zakaria', lastName: 'Azzouz', avatarUrl: null };
export const channelRef = (id: string, name: string, platform: 'facebook' | 'instagram' = 'facebook', status = 'active') => ({ id, name, platform, avatarUrl: null, status });
const act = (key: string, enabled = true, reasonCode?: string, primary = false) => ({ key, enabled, ...(reasonCode ? { reasonCode } : {}), ...(primary ? { primary } : {}) });
export const agentActions = (a: { status: string; pausedReason: string | null; channels: unknown[] }) => [
  act('test'),
  act('edit', true, undefined, true),
  ...(a.status === 'active' ? [act('pause')] : []),
  ...(a.status === 'paused' ? [act('resume', a.pausedReason !== 'plan', a.pausedReason === 'plan' ? 'PLAN_LIMIT' : undefined)] : []),
  act('duplicate'),
  act('export'),
  act('testLink'),
  act('delete', a.channels.length === 0, a.channels.length ? 'AGENT_HAS_CHANNELS' : undefined),
];
const metrics = { conversations: 1010, handledWithoutHuman: 879, orders: 142, confirmedPct: 71, delivered: 96, avgLatencyMs: 1900, p95LatencyMs: 4100, credits: 1420, satisfaction: null };
export const wizardFields = (over: Json = {}) => ({
  displayName: 'Amel (assistante)',
  avatarMode: 'initials',
  avatarUrl: null,
  languages: ['darija', 'arabizi', 'fr', 'ar'],
  defaultLanguage: 'darija',
  tone: 'warm',
  formality: 'follow_customer',
  emojiLevel: 'moderate',
  catalogScope: 'all',
  scopeCategoryIds: [],
  outOfStockBehavior: 'suggest_alternative',
  showMissingVariants: true,
  policies: { delivery: 'Grille Djaber par wilaya · 2–5 jours', payment: 'Paiement à la livraison uniquement (COD).' },
  faqCount: 3,
  capabilities: { replyText: true, imageRecognition: true, voiceTranscription: true, takeOrders: true, quoteDelivery: true, crossSell: false },
  orderFields: ['product', 'quantity', 'name', 'phone', 'wilaya', 'commune', 'address', 'phone2', 'note'].map((key, i) => ({ key, required: i < 7, locked: i < 5 })),
  maxQtyPerOrder: 5,
  maxAmountPerOrder: 50000,
  riskyClientBehavior: 'take_and_flag',
  recapMode: 'always',
  handoffRules: ['human_request', 'refund', 'complaint', 'anger', '3_unclear', 'off_topic', 'over_limits', 'risky_client', 'keyword'].map((kind) => ({ kind, enabled: kind !== 'risky_client' && kind !== 'keyword' })),
  handoffKeywords: [],
  businessHours: null,
  ...over,
});
export type AgentFixture = Json & { id: string; name: string; status: 'draft' | 'active' | 'paused'; pausedReason: 'manual' | 'plan' | null; channels: ReturnType<typeof channelRef>[]; version: number; currentVersion: number; wizardStep: number | null; pendingInsights: number; wizard: Json; customInstructions: string; actions: unknown[] };
export const agent = (over: Partial<AgentFixture> & { id: string; name: string }): AgentFixture => {
  const base = {
    description: 'Transforme les conversations en commandes confirmées.',
    status: 'active' as const,
    pausedReason: null,
    isActive: true,
    personality: 'friendly',
    customInstructions: '',
    productCardTemplate: null,
    closingInstructions: null,
    humanHandoffRules: null,
    model: { id: uuid(1, 'c'), label: 'gpt-4o-mini', provider: 'openai' },
    temperature: 0.6,
    maxTokens: 1200,
    responseDelaySec: 3,
    sellAllProducts: true,
    productCount: 142,
    imageRecognition: true,
    voiceTranscription: true,
    channels: [channelRef(IDS.amel, 'Boutique Amel')],
    preset: { key: 'vendeur-pro', name: 'Vendeur Pro', version: 6, updateAvailable: null },
    currentVersion: 3,
    lastActiveAt: at(4),
    scheduledActivateAt: null,
    wizardStep: 5,
    wizard: wizardFields(),
    metrics30d: metrics,
    pendingInsights: 0,
    version: 7,
    createdAt: '2026-03-12T09:00:00.000Z',
    updatedAt: at(60 * 20),
  };
  const a = { ...base, ...over } as AgentFixture;
  a.isActive = a.status === 'active';
  a.actions = over.actions ?? agentActions(a);
  return a;
};
export const fixtureAgents = (): AgentFixture[] => [
  agent({ id: IDS.vendeur, name: 'Vendeur Pro', pendingInsights: 3, channels: [channelRef(IDS.amel, 'Boutique Amel'), channelRef(IDS.cosmetics, 'Amel Cosmétiques', 'instagram')] }),
  agent({ id: IDS.service, name: 'Service Client', status: 'paused', pausedReason: 'manual', personality: 'professional', channels: [], description: 'Répond aux questions sur les délais, les retours et le suivi des colis.' }),
  agent({ id: IDS.planPaused, name: 'Conseiller Produit', status: 'paused', pausedReason: 'plan', personality: 'technical', channels: [channelRef(IDS.outlet, 'Amel Outlet')] }),
  agent({ id: IDS.draft, name: 'Réponse Express (brouillon)', status: 'draft', personality: 'casual', channels: [], wizardStep: 2, currentVersion: 0, lastActiveAt: null }),
];
export const fixturePresets = [
  { key: 'vendeur-pro', name: 'Vendeur Pro', tagline: 'Vend, devise la livraison, prend la commande', description: null, badge: 'recommended', version: 6, personality: 'friendly', temperature: 0.6, maxTokens: 1200, imageRecognition: true, voiceTranscription: true, responseDelaySec: 3, instructions: '' },
  { key: 'service-client', name: 'Service Client', tagline: 'Suivi, retours, réclamations → transfert', description: null, badge: null, version: 4, personality: 'professional', temperature: 0.4, maxTokens: 1000, imageRecognition: true, voiceTranscription: true, responseDelaySec: 2, instructions: '' },
  { key: 'conseiller-produit', name: 'Conseiller Produit', tagline: 'Compare, recommande, cross-sell', description: null, badge: null, version: 3, personality: 'technical', temperature: 0.5, maxTokens: 1400, imageRecognition: true, voiceTranscription: true, responseDelaySec: 3, instructions: '' },
  { key: 'reponse-express', name: 'Réponse Express', tagline: 'Court, rapide, sans photo', description: null, badge: null, version: 2, personality: 'casual', temperature: 0.6, maxTokens: 700, imageRecognition: false, voiceTranscription: true, responseDelaySec: 1, instructions: '' },
];
export const fixtureInsight = (n: number, over: Json = {}) => ({
  id: uuid(n, 'd'),
  agent: { id: IDS.vendeur, name: 'Vendeur Pro', status: 'active' },
  type: 'unknown_topic',
  customerMessage: 'vous avez des iPhone ?',
  aiResponse: 'Je me renseigne et je reviens vers vous',
  detail: 'hors catalogue · aucune règle',
  conversationId: uuid(n, 'e'),
  messageId: null,
  status: 'pending',
  resolution: null,
  topicKey: `topic-${n}`,
  occurrences: 12,
  channel: channelRef(IDS.amel, 'Boutique Amel'),
  createdAt: at(120),
  ...over,
});
export const fixtureInsights = () => [
  fixtureInsight(1),
  fixtureInsight(2, { type: 'unclear', customerMessage: '3abi lik l m3a lcouleur li 9bel', aiResponse: 'Pouvez-vous préciser ?', detail: 'arabizi + référence à un message ancien', occurrences: 7 }),
  fixtureInsight(3, { type: 'handoff', customerMessage: 'je veux parler à un humain', aiResponse: 'message de transfert', detail: 'règle « demande un humain » (normal)', occurrences: 31 }),
  fixtureInsight(4, { type: 'error', customerMessage: 'ch7al livraison l Tamanrasset', aiResponse: null, detail: 'fournisseur indisponible 18:40–19:05', occurrences: 2 }),
];
export const fixtureCredits = (over: Json = {}) => ({
  plan: { used: 3460, limit: 5000, remaining: 1540, periodStart: '2026-09-12T00:00:00.000Z', periodEnd: '2026-10-12T00:00:00.000Z' },
  packs: { remaining: 500 },
  total: 2040,
  reserved: 0,
  negative: false,
  exhausted: false,
  burnRatePerDay: 115,
  exhaustedEta: null,
  pricePerCreditDzd: 0.98,
  packPricePerCreditDzd: 0.75,
  ...over,
});
export const fixtureLedger = () => [
  { id: uuid(1, 'f'), at: at(30), action: 'text_reply', kind: 'debit', bucket: 'plan', credits: -1, balanceAfter: 1540, detail: 'Vendeur Pro · conv. Amina B.', agent: { id: IDS.vendeur, name: 'Vendeur Pro', status: 'active' }, conversationId: null, aiRunId: null },
  { id: uuid(2, 'f'), at: at(48), action: 'image_recognition', kind: 'debit', bucket: 'plan', credits: -5, balanceAfter: 1541, detail: 'Vendeur Pro · photo reconnue « La Robe satin »', agent: { id: IDS.vendeur, name: 'Vendeur Pro', status: 'active' }, conversationId: null, aiRunId: null },
  { id: uuid(3, 'f'), at: at(140), action: 'voice_transcription', kind: 'debit', bucket: 'plan', credits: -3, balanceAfter: 1546, detail: 'Vendeur Pro · note 0:40', agent: { id: IDS.vendeur, name: 'Vendeur Pro', status: 'active' }, conversationId: null, aiRunId: null },
  { id: uuid(4, 'f'), at: at(60 * 30), action: 'renewal', kind: 'credit', bucket: 'plan', credits: 5000, balanceAfter: 5000, detail: 'Plan Pro · période du 12 sept. au 12 oct.', agent: null, conversationId: null, aiRunId: null },
];
export const fixtureTurn = (n: number, over: Json = {}) => ({
  turnId: uuid(n, 'ab'.slice(0, 1)),
  sessionId: 's',
  reply: 'نعم 👋 الروب ساتان متوفرة بالأحمر في القياس M. السعر 4 900 دج.',
  status: 'OK',
  statusDetail: null,
  intent: 'sale',
  confidence: 0.97,
  model: 'gpt-4o-mini',
  modelDetail: { id: uuid(1, 'c'), temperature: 0.6, maxTokens: 1200 },
  tokens: { input: 2140, output: 186 },
  latencyMs: 2300,
  toolCalls: [{ name: 'search_products', args: { query: 'روب ساتان أحمر' }, result: { count: 3, items: ['La Robe satin (RS)', 'Robe longue mousseline', 'Kimono brodé'] }, simulated: false }],
  cards: [{ productId: uuid(1, 'c'), name: 'La Robe satin', price: 4900, imageUrl: null, variantLabel: 'Rouge · M (stock 7)' }],
  creditsInProd: 1,
  language: 'ar',
  promptPreview: ['Personnalité · amical', 'Instructions (1 240 car.)', 'Règles de transfert · 2', 'Catalogue : 128 produits → recherche (> 60)', 'Règle de langue (stricte)'],
  promptSections: [],
  systemMessages: [],
  ...over,
});
export const orderTurn = (n: number) =>
  fixtureTurn(n, {
    reply: 'شكراً أمينة ✅ طلبك رقم TEST-4821 (محاكاة): روب ساتان أحمر M × 1 = 4 900 دج + التوصيل 400 = 5 300 دج.',
    toolCalls: [{ name: 'create_order', args: { clientName: 'Amina', phone: '0555123456', wilayaId: 19 }, result: { ok: true, number: 'TEST-4821', total: 5300, simulated: true }, simulated: true }],
    cards: [],
  });
export const handoffTurn = (n: number) => fixtureTurn(n, { reply: 'Je transmets votre demande à un conseiller.', status: 'HANDOFF', statusDetail: 'refund', intent: 'complaint', confidence: 0.91, toolCalls: [], cards: [], language: 'fr', systemMessages: [{ key: 'handoff', text: 'Je transmets à un collègue, il vous répond dans l’heure 🙏' }] });
export const fixtureReadiness = (over: { ready?: boolean; checks?: Json[] } = {}) => ({
  ready: over.ready ?? true,
  checks: over.checks ?? [
    { key: 'catalog', ok: true, label: 'Catalogue : 142 produits actifs · 3 sans photo (l’agent les décrira sans image)', count: 142, link: '/products' },
    { key: 'feeGrid', ok: true, label: 'Grille de livraison : 58 wilayas renseignées' },
    { key: 'policies', ok: true, label: 'Règles de la boutique : 4 / 4' },
    { key: 'channels', ok: true, label: 'Canal : Boutique Amel (Facebook) — libre' },
    { key: 'emailVerified', ok: true, label: 'E-mail vérifié · plan Pro · 1 540 crédits restants' },
    { key: 'pendingModeration', ok: false, blocking: false, label: 'Produits en attente de validation Djaber : 2 (non proposés tant que non validés)', link: '/products?tab=pending' },
  ],
});
const SCENARIOS = ['darija_price', 'arabizi_delivery', 'photo', 'voice', 'off_catalog', 'anger', 'qty_limit', 'refund'];
export const fixtureScenarios = (status: 'pass' | 'fail' | 'error' | null = 'pass') => SCENARIOS.map((scenarioKey, i) => ({ scenarioKey, status: status === 'pass' && i === 5 ? 'pass' : status, summary: status ? ['Prix correct 4 500 DA · propose 100 ml · demande la wilaya', '500 DA domicile · 350 DA stop-desk El Eulma', 'Produit reconnu « La Robe satin » · demande la taille', 'Transcrite · commande prise avec récap', '« Nous ne vendons pas ça » · propose le catalogue', 'Transfert immédiat · message de transfert · file d’attente', 'Transfert (quantité max 5)', 'Transfert · motif « remboursement »'][i] : null, at: status ? at(5) : null, agentVersion: status ? 3 : null }));
export const fixtureVersions = () => [
  { version: 3, createdAt: at(60 * 20), createdBy: user, note: 'Ajout règle « mot-clé arnaque » · FAQ +1', source: 'manual', isCurrent: true },
  { version: 2, createdAt: '2026-09-28T10:00:00.000Z', createdBy: { ...user, firstName: 'Nadia', lastName: 'Ferhat' }, note: 'Activation vocal · quantité max 5', source: 'manual', isCurrent: false },
  { version: 1, createdAt: '2026-03-12T09:00:00.000Z', createdBy: user, note: null, source: 'wizard', isCurrent: false },
];
export const fixtureFaq = () => [
  { id: uuid(1, 'c'), question: 'Le parfum tient combien de temps ?', answer: '8 à 10 heures sur peau, 24 h sur vêtement.', source: 'manual', askedCount: null, sortOrder: 0, isActive: true, createdAt: at(900) },
  { id: uuid(2, 'c'), question: 'Vous livrez à Tamanrasset ?', answer: 'Oui, 5 à 7 jours via ZR Express, 1 200 DA.', source: 'page_extraction', askedCount: null, sortOrder: 1, isActive: true, createdAt: at(800) },
  { id: uuid(3, 'c'), question: 'C’est original ?', answer: 'Produits importés avec facture ; pas de contrefaçon.', source: 'ai_suggested', askedCount: 12, sortOrder: 2, isActive: true, createdAt: at(700) },
];
export const fixtureChannel = (id: string, name: string, over: Json = {}) => ({
  ...channelRef(id, name),
  externalId: `10${id.slice(0, 8).replace(/\D/g, '1')}55`,
  followersCount: 12480,
  pausedReason: null,
  parentChannelId: null,
  agent: null,
  icebreaker: null,
  counts: { conversations: 128, active: 12, needsHuman: 2, unread: 3, messages7d: 240, inbound7d: 130, productsInScope: 128 },
  health: { webhookSubscribed: true, tokenValid: true, tokenCheckedAt: at(30), tokenExpiresAt: null, permissions: {}, lastInboundAt: at(3), lastSyncAt: null },
  connectedAt: '2026-08-12T09:02:00.000Z',
  connectedBy: user,
  actions: [act('reconnect', false, 'CONFLICT'), act('syncInfo'), act('pause'), act('disconnect')],
  ...over,
});
export const fixtureChannelList = () => [
  fixtureChannel(IDS.amel, 'Boutique Amel', { agent: { id: IDS.vendeur, name: 'Vendeur Pro', status: 'active' } }),
  fixtureChannel(IDS.cosmetics, 'Amel Cosmétiques', { platform: 'instagram', parentChannelId: IDS.amel }),
  fixtureChannel(IDS.outlet, 'Amel Outlet', { status: 'needs_reconnect', health: { webhookSubscribed: false, tokenValid: false, tokenCheckedAt: at(600), tokenExpiresAt: null, permissions: {}, lastInboundAt: null, lastSyncAt: null } }),
];

/* ---------- the mocked M4 backend ---------- */
export type World = {
  agents: AgentFixture[];
  planLimit: { limit: number; current: number };
  channels: Json[];
  insights: Json[];
  faq: Json[];
  credits: Json;
  ledger: Json[];
  readiness: Json;
  scenarios: Json[];
  /** answers of `POST /agents/:id/test`, in order (the last one repeats) */
  turns: Json[];
  /** every write, in order: `PATCH /agents/<id> {…}` */
  writes: string[];
  /** one-shot failures: `'PATCH /agents/:id'` → error to answer once */
  failures: Record<string, { status: number; code: string; message: string; params?: Json; details?: unknown; headers?: Record<string, string>; sticky?: boolean }>;
  /** open threads reported by the first `POST /agents/:id/pause` (0 = pauses at once) */
  openThreads: number;
  /** public link state */
  sharedExpired?: boolean;
  /** `GET /channels/:id/analysis` (CHN-08); `POST` moves it to `analysisAfterRun` when given */
  analysis?: Json;
  analysisAfterRun?: Json;
  /** `GET /messages/:id/ai-run`; null ⇒ 404 */
  aiRun?: Json | null;
  seq: number;
};
export const world = (over: Partial<World> = {}): World => ({
  agents: fixtureAgents(),
  planLimit: { limit: 5, current: 3 },
  channels: fixtureChannelList(),
  insights: fixtureInsights(),
  faq: fixtureFaq(),
  credits: fixtureCredits(),
  ledger: fixtureLedger(),
  readiness: fixtureReadiness(),
  scenarios: fixtureScenarios(),
  turns: [fixtureTurn(1)],
  writes: [],
  failures: {},
  openThreads: 0,
  seq: 100,
  ...over,
});
const keyOf = (method: string, path: string) => `${method} ${path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id').replace(/\/versions\/\d+/, '/versions/:v')}`;

/**
 * Serves the M4 endpoints from `w`. Writes are recorded in `w.writes` and applied to the fixtures, so a spec can
 * assert both the request the page sent and the state it shows afterwards.
 */
export async function mockAgents(page: Page, w: World) {
  const refresh = (a: AgentFixture) => Object.assign(a, { isActive: a.status === 'active', actions: agentActions(a) });
  await page.route(/\/api\/v1\/(agents|agent-insights|agent-test|ai\/routes|credits|channels|messages\/[^/]+\/ai-run|jobs|products\/bulk\/agent|categories)(\/|\?|$)/, async (route) => {
    const req = route.request();
    const method = req.method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...CORS, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const url = new URL(req.url());
    const path = url.pathname.replace('/api/v1', '');
    const body = (() => {
      try {
        return JSON.parse(req.postData() ?? '{}') as Json;
      } catch {
        return {};
      }
    })();
    if (method !== 'GET') w.writes.push(`${method} ${path} ${req.postData() ?? ''}`.trim());
    const planned = w.failures[keyOf(method, path)];
    if (planned) {
      if (!planned.sticky) delete w.failures[keyOf(method, path)];
      return fail(route, planned.status, planned.code, planned.message, planned.params, planned.details, planned.headers);
    }
    const q = url.searchParams;

    /* ---- reference data ---- */
    if (path === '/categories') return route.fallback();
    if (path === '/ai/routes') return fulfil(route, [{ capability: 'text', model: { id: uuid(1, 'c'), label: 'gpt-4o-mini', provider: 'openai' }, failover: false }]);
    if (path === '/credits') return fulfil(route, w.credits);
    if (path === '/credits/ledger') {
      const action = q.get('action')?.split(',');
      const rows = w.ledger.filter((r) => (!action || action.includes(String(r.action))) && (!q.get('bucket') || r.bucket === q.get('bucket')));
      return fulfil(route, rows, { page: 1, pageSize: 25, total: rows.length });
    }
    if (path.startsWith('/jobs/')) return fulfil(route, { id: path.split('/')[2], kind: 'agent_test_scenarios', status: 'done', progress: 100, total: null, result: null, resultUrl: null, error: null, createdAt: at(1), updatedAt: at(0), expiresAt: null });

    /* ---- channels (pages the wizard links) ---- */
    if (path === '/channels') return fulfil(route, w.channels, { planLimit: { limit: 3, current: w.channels.length } });
    if (path === '/channels/app-review-status') return fulfil(route, { approved: true, instagramApproved: true, humanAgentApproved: true, permissions: [] });
    const ch = /^\/channels\/([0-9a-f-]{36})(\/.*)?$/.exec(path);
    if (ch) {
      const c = w.channels.find((x) => x.id === ch[1]);
      if (!c) return fail(route, 404, 'NOT_FOUND', 'Introuvable');
      if (method === 'PUT' && ch[2] === '/agent') {
        const target = w.agents.find((a) => a.id === body.agentId) ?? null;
        const current = c.agent as { id: string; name: string } | null;
        if (target && current && current.id !== target.id && !body.move) return fail(route, 409, 'AGENT_PAGE_ALREADY_ASSIGNED', `Page déjà liée à « ${current.name} ». La déplacer ?`, { agentName: current.name });
        for (const a of w.agents) {
          a.channels = a.channels.filter((x) => x.id !== c.id);
          refresh(a);
        }
        if (target) {
          target.channels.push(channelRef(String(c.id), String(c.name), c.platform as 'facebook', String(c.status)));
          refresh(target);
        }
        c.agent = target ? { id: target.id, name: target.name, status: target.status } : null;
        return fulfil(route, c);
      }
      if (method === 'PUT' && ch[2] === '/icebreaker') return fulfil(route, Object.assign(c, { icebreaker: String(body.text ?? '') || null }));
      if (ch[2] === '/analysis' && method === 'GET') return fulfil(route, w.analysis ?? fixtureAnalysis({ state: 'none', jobId: null, items: [], progress: 0, postsDone: 0, postsTotal: 0, startedAt: null, finishedAt: null, runsLeftToday: 3 }));
      if (ch[2] === '/analysis' && method === 'POST') {
        if (w.analysisAfterRun) w.analysis = w.analysisAfterRun;
        return fulfil(route, { jobId: uuid(80, 'e') }, {}, 202);
      }
      if (ch[2] === '/analysis/import' && method === 'POST') {
        const items = (body.items as { name: string }[]) ?? [];
        return fulfil(route, { created: items.map((it, i) => ({ key: `k${i}`, productId: uuid(200 + i, 'c'), sku: `FB-${String(i + 1).padStart(4, '0')}` })), failed: [] });
      }
      if (method === 'GET' && !ch[2]) return fulfil(route, c);
      if (method === 'GET' && ch[2] === '/summary') return fulfil(route, { counts: c.counts, agent: c.agent ? { ...(c.agent as object), productsInScope: 128 } : null, health: c.health, children: [], lastHistorySyncJobId: null });
      if (method === 'GET' && ch[2] === '/insights') return fail(route, 422, 'INBOX_INSIGHTS_UNAVAILABLE', 'Statistiques Meta indisponibles.');
      if (method === 'GET' && ch[2] === '/events') return fulfil(route, [], { nextCursor: null, hasMore: false });
      return route.fallback();
    }

    if (/^\/messages\/[^/]+\/ai-run$/.test(path)) return w.aiRun === null ? fail(route, 404, 'NOT_FOUND', 'Introuvable') : fulfil(route, w.aiRun ?? fixtureAiRun());
    if (path === '/products/bulk/agent') return fulfil(route, { results: ((body.ids as string[]) ?? []).map((id) => ({ id, ok: true })) }, { ok: ((body.ids as string[]) ?? []).length, failed: 0 });

    /* ---- insights ---- */
    if (path === '/agent-insights') {
      const status = q.get('status') ?? 'pending';
      const types = q.get('type')?.split(',');
      const rows = w.insights.filter((i) => i.status === status && (!q.get('agentId') || (i.agent as { id: string }).id === q.get('agentId')) && (!types || types.includes(String(i.type))) && (!q.get('conversationId') || i.conversationId === q.get('conversationId')));
      const count = (s: string) => w.insights.filter((i) => i.status === s).length;
      return fulfil(route, rows.slice(0, Number(q.get('pageSize') ?? 25)), { page: 1, pageSize: 25, total: rows.length, counts: { pending: count('pending'), resolved: count('resolved'), dismissed: count('dismissed') } });
    }
    const ins = /^\/agent-insights\/([0-9a-f-]{36})\/resolve$/.exec(path);
    if (ins && method === 'POST') {
      const i = w.insights.find((x) => x.id === ins[1]);
      if (!i) return fail(route, 404, 'NOT_FOUND', 'Introuvable');
      if (i.status !== 'pending') return fail(route, 422, 'INSIGHT_ALREADY_RESOLVED', 'Déjà traité.');
      Object.assign(i, { status: body.action === 'ignored_30d' ? 'dismissed' : 'resolved', resolution: body.action });
      const owner = w.agents.find((a) => a.id === (i.agent as { id: string }).id);
      if (owner) {
        owner.pendingInsights = Math.max(0, owner.pendingInsights - 1);
        if (body.action === 'instruction') {
          owner.customInstructions = `${owner.customInstructions}\n- ${String(body.instruction)}`.trim();
          owner.currentVersion += 1;
          owner.version += 1;
        }
      }
      return fulfil(route, i);
    }
    if (path === '/agent-insights/bulk/dismiss' && method === 'POST') {
      const ids = (body.ids as string[]) ?? [];
      for (const i of w.insights) if (ids.includes(String(i.id))) Object.assign(i, { status: 'dismissed', resolution: 'ignored_30d' });
      return fulfil(route, { results: ids.map((id) => ({ id, ok: true })) }, { ok: ids.length, failed: 0 });
    }

    /* ---- public shared playground ---- */
    const shared = /^\/agent-test\/([^/]+)(\/messages)?$/.exec(path);
    if (shared) {
      if (w.sharedExpired) return fail(route, 410, 'AGENT_TEST_LINK_EXPIRED', 'Lien de test expiré (24 h).');
      if (!shared[2]) return fulfil(route, { agentName: 'Amel (assistante)', avatarUrl: null, expiresAt: new Date(Date.now() + 20 * 3_600_000).toISOString() });
      const t = w.turns[Math.min(w.turns.length - 1, w.writes.filter((x) => x.includes('/agent-test/')).length - 1)] as { reply: string; cards: unknown[] };
      return fulfil(route, { reply: t.reply, cards: t.cards });
    }

    /* ---- agents ---- */
    if (path === '/agents' && method === 'GET') {
      const status = q.get('status')?.split(',');
      const text = (q.get('q') ?? '').toLowerCase();
      const rows = w.agents.filter((a) => (!status || status.includes(a.status)) && (!text || a.name.toLowerCase().includes(text)) && (!q.get('channelId') || a.channels.some((c) => q.get('channelId')!.split(',').includes(c.id))));
      return fulfil(route, rows, { planLimit: w.planLimit });
    }
    if (path === '/agents/presets') return fulfil(route, fixturePresets);
    if (path === '/agents' && method === 'POST') {
      const preset = fixturePresets.find((p) => p.key === body.presetKey);
      const created = agent({ id: uuid(++w.seq), name: String(body.name ?? 'Agent'), description: (body.description as string) ?? null, status: 'draft', channels: [], wizardStep: 1, currentVersion: 0, version: 1, lastActiveAt: null, personality: preset?.personality ?? 'friendly', preset: preset ? { key: preset.key, name: preset.name, version: preset.version, updateAvailable: null } : null, wizard: wizardFields({ ...(body.wizard as Json), faqCount: 0, policies: {} }) });
      // the capabilities of the preset come with the draft (Réponse Express: no photo)
      if (preset) Object.assign(created, { imageRecognition: preset.imageRecognition, voiceTranscription: preset.voiceTranscription, responseDelaySec: preset.responseDelaySec, wizard: { ...created.wizard, capabilities: { ...(created.wizard.capabilities as Json), imageRecognition: preset.imageRecognition, voiceTranscription: preset.voiceTranscription } } });
      w.agents.push(created);
      return fulfil(route, created, {}, 201);
    }
    if (path === '/agents/generate' && method === 'POST') return fulfil(route, { jobId: uuid(77, 'e') }, {}, 202);
    const bulk = /^\/agents\/bulk\/(pause|resume|delete)$/.exec(path);
    if (bulk && method === 'POST') {
      const results = ((body.ids as string[]) ?? []).map((id) => {
        const a = w.agents.find((x) => x.id === id);
        if (!a) return { id, ok: false, error: { code: 'NOT_FOUND', message: 'Introuvable' } };
        if (bulk[1] === 'delete' && a.channels.length) return { id, ok: false, error: { code: 'AGENT_HAS_CHANNELS', message: `${a.channels.length} pages rattachées : changez les canaux d'abord.` } };
        if (bulk[1] === 'delete') w.agents = w.agents.filter((x) => x.id !== id);
        else refresh(Object.assign(a, bulk[1] === 'pause' ? { status: 'paused', pausedReason: 'manual' } : { status: 'active', pausedReason: null }));
        return { id, ok: true };
      });
      return fulfil(route, { results }, { ok: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length });
    }
    const m = /^\/agents\/([0-9a-f-]{36})(\/.*)?$/.exec(path);
    const a = m ? w.agents.find((x) => x.id === m[1]) : undefined;
    if (!m || !a) return fail(route, 404, 'NOT_FOUND', 'Introuvable');
    const sub = m[2] ?? '';
    if (!sub && method === 'GET') return fulfil(route, a);
    if (!sub && method === 'PATCH') {
      if (body.version !== a.version) return fail(route, 409, 'CONFLICT', 'Modifié par quelqu’un d’autre.', {}, { changedBy: { firstName: 'Nadia', lastName: 'F.' }, changedAt: at(0.3), current: a });
      const { wizard, version: _v, step, note: _n, ...core } = body as { wizard?: Json; version: number; step?: number; note?: string } & Json;
      Object.assign(a, core, { wizard: { ...a.wizard, ...(wizard ?? {}) }, version: a.version + 1, wizardStep: step ? Math.max(a.wizardStep ?? 0, step) : a.wizardStep, updatedAt: at(0) });
      if (a.status !== 'draft') a.currentVersion += 1;
      return fulfil(route, refresh(a));
    }
    if (!sub && method === 'DELETE') {
      if (a.channels.length) return fail(route, 409, 'AGENT_HAS_CHANNELS', `${a.channels.length} pages rattachées : changez les canaux d'abord.`, { count: a.channels.length });
      w.agents = w.agents.filter((x) => x.id !== a.id);
      return route.fulfill({ status: 204, headers: CORS });
    }
    if (method === 'POST') {
      if (sub === '/pause') {
        if (w.openThreads > 0 && !body.confirm) return fail(route, 409, 'AGENT_PAUSED_WITH_OPEN_THREADS', `${w.openThreads} conversations attendent une réponse : elles passeront en « À traiter ».`, { count: w.openThreads });
        return fulfil(route, refresh(Object.assign(a, { status: 'paused', pausedReason: 'manual' })));
      }
      if (sub === '/resume') return fulfil(route, refresh(Object.assign(a, { status: 'active', pausedReason: null })));
      if (sub === '/duplicate') {
        const copy = agent({ ...a, id: uuid(++w.seq), name: `${a.name} (copie)`, status: 'draft', channels: [], wizardStep: 4, currentVersion: 0, actions: undefined });
        w.agents.push(copy);
        return fulfil(route, copy, {}, 201);
      }
      if (sub === '/activate') {
        if (a.channels.length === 0) return fail(route, 422, 'AGENT_NO_CHANNEL', 'Rattachez au moins une page avant d’activer.');
        if (w.planLimit.current >= w.planLimit.limit) return fail(route, 403, 'PLAN_LIMIT', 'Limite du plan atteinte.', { resource: 'agents', limit: w.planLimit.limit, current: w.planLimit.current });
        if (body.at) return fulfil(route, Object.assign(a, { scheduledActivateAt: body.at }));
        w.planLimit.current += 1;
        return fulfil(route, refresh(Object.assign(a, { status: 'active', pausedReason: null, currentVersion: Math.max(1, a.currentVersion), wizardStep: 5 })));
      }
      if (sub === '/test') {
        const n = w.writes.filter((x) => x.startsWith(`POST ${path}`)).length;
        return fulfil(route, w.turns[Math.min(w.turns.length - 1, n - 1)]);
      }
      if (sub === '/test/flag') return fulfil(route, null);
      if (sub === '/test-links') return fulfil(route, { url: `http://localhost:3010/fr/agent-test/tok_${a.id.slice(-4)}`, expiresAt: new Date(Date.now() + 24 * 3_600_000).toISOString() }, {}, 201);
      if (sub === '/test-scenarios') return fulfil(route, { jobId: uuid(78, 'e') }, {}, 202);
      if (sub === '/faq') {
        const row = { id: uuid(++w.seq, 'c'), question: body.question, answer: body.answer, source: 'manual', askedCount: null, sortOrder: w.faq.length, isActive: true, createdAt: at(0) };
        w.faq.push(row);
        return fulfil(route, row, {}, 201);
      }
      if (sub === '/faq/extract') return fulfil(route, { jobId: uuid(79, 'e') }, {}, 202);
      // the import answers at once (`{ created, skipped }`, M11 contract) — no job
      if (sub === '/faq/import') return fulfil(route, { created: [], skipped: 0 }, {}, 201);
      const restore = /^\/versions\/(\d+)\/restore$/.exec(sub);
      if (restore) return fulfil(route, refresh(Object.assign(a, { currentVersion: a.currentVersion + 1, version: a.version + 1 })));
      if (sub === '/apply-preset-update') return fulfil(route, refresh(Object.assign(a, { currentVersion: a.currentVersion + 1, version: a.version + 1, preset: { ...(a.preset as Json), updateAvailable: null } })));
    }
    const faq = /^\/faq\/([0-9a-f-]{36})$/.exec(sub);
    if (faq && method === 'DELETE') {
      w.faq = w.faq.filter((f) => f.id !== faq[1]);
      return route.fulfill({ status: 204, headers: CORS });
    }
    if (faq && method === 'PATCH') return fulfil(route, Object.assign(w.faq.find((f) => f.id === faq[1]) ?? {}, body));
    if (method !== 'GET') return fail(route, 404, 'NOT_FOUND', 'Introuvable');
    if (sub === '/faq') return fulfil(route, w.faq);
    if (sub === '/readiness') return fulfil(route, w.readiness);
    if (sub === '/test-scenarios') return fulfil(route, w.scenarios);
    if (sub === '/versions') return fulfil(route, fixtureVersions().map((v) => ({ ...v, version: v.version + (a.currentVersion - 3), isCurrent: v.isCurrent })).filter((v) => v.version > 0));
    if (/^\/versions\/\d+\/diff$/.test(sub)) return fulfil(route, { version: Number(sub.split('/')[2]), against: Number(q.get('against') ?? a.currentVersion), changes: [{ field: 'maxQtyPerOrder', before: 5, after: 8 }, { field: 'handoffKeywords', before: [], after: ['arnaque'] }] });
    if (sub === '/metrics') return fulfil(route, { ...metrics, conversations: 240, from: q.get('from'), to: q.get('to'), aiMessages: 1310, handoffs: 31, resolutionRate: 0.87, lastActiveAt: a.lastActiveAt });
    if (sub === '/export') return fulfil(route, { name: a.name, wizard: a.wizard });
    if (sub === '/test/export') return fulfil(route, { sessionId: q.get('sessionId'), turns: [] });
    return fail(route, 404, 'NOT_FOUND', 'Introuvable');
  });
}

/** `GET /messages/:id/ai-run` fixture (inbox inspector). */
export const fixtureAiRun = (over: Json = {}) => ({
  id: uuid(5, 'e'),
  kind: 'reply',
  status: 'ok',
  intent: 'sale',
  model: 'gpt-4o-mini',
  provider: 'openai',
  usedFallback: false,
  tokens: { input: 2140, output: 186 },
  latencyMs: 2300,
  confidence: 0.97,
  credits: 1,
  toolCalls: [{ name: 'search_products', args: { query: 'robe satin' }, result: { count: 3 } }],
  error: null,
  startedAt: at(4),
  ...over,
});

/** CHN-08 fixture (`GET /channels/:id/analysis`). */
export const fixtureAnalysis = (over: Json = {}) => ({
  state: 'done',
  jobId: uuid(80, 'e'),
  progress: 100,
  postsTotal: 30,
  postsDone: 30,
  items: [
    { key: 'p1', postId: 'post-1', name: 'Robe longue mousseline', description: null, price: 6500, category: 'Vêtements', imageUrl: null, duplicateOf: null },
    { key: 'p2', postId: 'post-2', name: 'Ensemble lin beige', description: null, price: 7900, category: 'Vêtements', imageUrl: null, duplicateOf: null },
    { key: 'p3', postId: 'post-3', name: 'Parfum Oud 50 ml', description: null, price: 4900, category: 'Parfums', imageUrl: null, duplicateOf: 'Parfum Oud 50 ml' },
    { key: 'p4', postId: 'post-4', name: 'Sandales dorées', description: null, price: null, category: 'Chaussures', imageUrl: null, duplicateOf: null },
  ],
  startedAt: at(3),
  finishedAt: at(2),
  runsLeftToday: 2,
  error: null,
  ...over,
});
