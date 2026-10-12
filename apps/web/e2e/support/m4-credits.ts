// Extra fixtures and route handlers of the M4 specs for credits, page analysis and "generate an agent from a page".
// They are registered AFTER `mockAgents(page, w)` (a later `page.route` runs first) and fall back to it for the rest.
import { expect, type Page } from '@playwright/test';
import { fulfil } from './m3-misc';
import { agent, fail, IDS, type AgentFixture, type World } from './m4';

type Json = Record<string, unknown>;
const at = (minAgo: number) => new Date(Date.now() - minAgo * 60_000).toISOString();

/* ---------- credits ---------- */
/** Records the query string of every `GET /credits/ledger` (then lets `mockAgents` answer). */
export async function recordLedger(page: Page): Promise<URLSearchParams[]> {
  const calls: URLSearchParams[] = [];
  await page.route(/\/api\/v1\/credits\/ledger(\?|$)/, (route) => {
    if (route.request().method() === 'GET') calls.push(new URL(route.request().url()).searchParams);
    return route.fallback();
  });
  return calls;
}

/** A ledger of `total` rows served page by page (`page`, `pageSize`), to exercise the pagination. */
export async function mockLongLedger(page: Page, total: number): Promise<URLSearchParams[]> {
  const calls: URLSearchParams[] = [];
  const rows = Array.from({ length: total }, (_, i) => ({
    id: `ffffffff-0000-7000-8000-${String(1000 + i).padStart(12, '0')}`,
    at: at(10 + i),
    action: 'text_reply',
    kind: 'debit',
    bucket: 'plan',
    credits: -1,
    balanceAfter: 5000 - i,
    detail: `conv. n° ${i + 1}`,
    agent: { id: IDS.vendeur, name: 'Vendeur Pro', status: 'active' },
    conversationId: null,
    aiRunId: null,
  }));
  await page.route(/\/api\/v1\/credits\/ledger(\?|$)/, (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const q = new URL(route.request().url()).searchParams;
    calls.push(q);
    const p = Number(q.get('page') ?? 1);
    const size = Number(q.get('pageSize') ?? 25);
    return fulfil(route, rows.slice((p - 1) * size, p * size), { page: p, pageSize: size, total });
  });
  return calls;
}

/* ---------- jobs ---------- */
export const GENERATE_JOB = 'eeeeeeee-0000-7000-8000-000000000077'; // the id `mockAgents` answers to `POST /agents/generate`
export const job = (id: string, over: Json = {}) => ({ id, kind: 'agent_generation', status: 'done', progress: 100, total: null, result: null, resultUrl: null, error: null, createdAt: at(1), updatedAt: at(0), expiresAt: null, ...over });

/** `Job.result` of an agent generation (`AgentGenerationResult`, 04-ai-pipeline §14). */
export const fixtureGeneration = (over: Json = {}) => ({
  channelId: IDS.amel,
  conversations: 128,
  messages: 1840,
  summary: 'Boutique de prêt-à-porter féminin : les clientes demandent surtout le prix, les tailles et le délai de livraison.',
  languages: [
    { code: 'darija', pct: 62 },
    { code: 'fr', pct: 30 },
    { code: 'ar', pct: 8 },
  ],
  topQuestions: [
    { question: 'Ch7al el prix ?', count: 41 },
    { question: 'Vous livrez à Sétif ?', count: 27 },
    { question: 'Kayen taille L ?', count: 12 },
  ],
  tone: 'chaleureux',
  proposedInstructions: 'Réponds en darija par défaut.\nDonne toujours le prix avec la livraison.\nDemande la wilaya avant de confirmer.',
  proposedFaq: [
    { q: 'Délai de livraison ?', a: '2 à 5 jours selon la wilaya.' },
    { q: 'Échange possible ?', a: 'Oui, sous 3 jours.' },
  ],
  proposedPolicies: {},
  linkedAgent: { id: IDS.vendeur, name: 'Vendeur Pro', status: 'active' },
  ...over,
});

export type GenerateMock = {
  /** current answer of `GET /jobs/<GENERATE_JOB>` — mutate it to move the job forward */
  job: Json;
  /** bodies of `POST /jobs/:id/cancel` and `POST /agents/generate/:jobId/apply`, in order */
  calls: string[];
};
/**
 * Serves the job of a generation and its `apply`: a new draft agent (`{}`) or the linked agent with a new version
 * (`{ agentId, confirm: true }`). The agent is added to / updated in `w.agents` so that the next screen can read it.
 */
export async function mockGeneration(page: Page, w: World, initial: Json): Promise<GenerateMock> {
  const m: GenerateMock = { job: initial, calls: [] };
  await page.route(/\/api\/v1\/jobs\/[0-9a-f-]{36}(\/cancel)?(\?|$)/, (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fallback();
    const path = new URL(req.url()).pathname.replace('/api/v1', '');
    if (req.method() === 'POST' && path.endsWith('/cancel')) {
      m.calls.push(`POST ${path} ${req.postData() ?? ''}`.trim());
      m.job = { ...m.job, status: 'cancelled' };
      return fulfil(route, m.job);
    }
    if (req.method() === 'GET') return fulfil(route, m.job);
    return route.fallback();
  });
  await page.route(/\/api\/v1\/agents\/generate\/[0-9a-f-]{36}\/apply(\?|$)/, (route) => {
    const req = route.request();
    if (req.method() !== 'POST') return route.fallback();
    const path = new URL(req.url()).pathname.replace('/api/v1', '');
    m.calls.push(`POST ${path} ${req.postData() ?? ''}`.trim());
    const body = JSON.parse(req.postData() ?? '{}') as { agentId?: string; confirm?: boolean };
    if (body.agentId) {
      const target = w.agents.find((a) => a.id === body.agentId);
      if (!target) return fail(route, 404, 'NOT_FOUND', 'Introuvable');
      if (!body.confirm) return fail(route, 409, 'CONFLICT', 'Confirmation requise.');
      Object.assign(target, { customInstructions: String((m.job.result as Json | null)?.proposedInstructions ?? ''), currentVersion: target.currentVersion + 1, version: target.version + 1 });
      return fulfil(route, target);
    }
    const created: AgentFixture = agent({ id: 'aaaaaaaa-0000-7000-8000-000000000555', name: 'Agent Boutique Amel', status: 'draft', channels: [], wizardStep: 1, currentVersion: 0, version: 1, lastActiveAt: null, customInstructions: String((m.job.result as Json | null)?.proposedInstructions ?? '') });
    w.agents.push(created);
    return fulfil(route, created, {}, 201);
  });
  return m;
}

/* ---------- sign-in on a busy dev server ---------- */
/**
 * `loginHome` with patience: the specs share one `next dev` server with other runs, so the login form can stay on its
 * loading state for a while (route compiling, session probe). The form is awaited, and the page reloaded if it never
 * shows up, instead of spending the whole test timeout inside one `fill`.
 */
export async function signIn(page: Page, a: { email: string; password: string }) {
  await expect(async () => {
    await page.goto('/fr/login', { timeout: 60_000 });
    if (/\/fr\/home$/.test(page.url())) return;
    // a login page left on "Chargement…" (scripts still compiling) is loaded again by the next attempt
    await page.locator('#email').waitFor({ state: 'visible', timeout: 45_000 });
    await page.locator('#email').fill(a.email);
    await page.locator('#password').fill(a.password);
    await page.locator('form button[type=submit]').click();
    await expect(page).toHaveURL(/\/fr\/home$/, { timeout: 60_000 });
  }).toPass({ timeout: 240_000 });
}
