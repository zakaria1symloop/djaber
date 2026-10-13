// Helpers of the M11 suites (API keys, outbound webhooks, Google Sheets, public pages). Nothing leaves the machine: webhook
// receivers are local HTTP servers on 127.0.0.1, Google is the simulated driver (SHEETS_DRIVER=fake), `localNetworkOnly`
// fails any fetch to a non-local host.
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { rawPrisma as db, TenantContext } from '@djaber/db';
import { ProcessorRegistry } from '../../src/core/queue/processor.registry';
import { FAKE_SHEETS } from '../../src/modules/integrations/integrations.tokens';
import type { FakeSheetsGateway } from '../../src/modules/integrations/sheets/fake-sheets.gateway';
import type { TestApp } from './app';
import type { Actor } from './actors';

export { db };

/** Only 127.0.0.1 / localhost may be fetched (local test receivers); anything else throws. */
export const localNetworkOnly = () => {
  const original = globalThis.fetch;
  const spy = jest.fn(async (input: unknown, init?: RequestInit) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') throw new Error(`unexpected network call in tests: ${url.origin}`);
    return original(input as never, init);
  });
  globalThis.fetch = spy as unknown as typeof fetch;
  return { spy, restore: () => (globalThis.fetch = original) };
};

export type Hit = { headers: IncomingMessage['headers']; body: string; at: number };
export type Receiver = { url: string; hits: Hit[]; status: number; delayMs: number; close: () => Promise<void> };

/** A local webhook receiver: records every POST and answers `status` (changeable) after `delayMs`. */
export const receiver = async (path = '/hook'): Promise<Receiver> => {
  const r: Receiver = { url: '', hits: [], status: 200, delayMs: 0, close: async () => undefined };
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      r.hits.push({ headers: req.headers, body: Buffer.concat(chunks).toString('utf8'), at: Date.now() });
      setTimeout(() => {
        res.statusCode = r.status;
        res.end(r.status < 300 ? 'ok' : 'boom');
      }, r.delayMs);
    });
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', () => ok()));
  r.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`;
  r.close = () => new Promise<void>((ok) => server.close(() => ok()));
  return r;
};

type Row = { id: string; topic: string; key: string; payload: any; workspaceId: string | null };

/**
 * The worker, synchronously, for the integrations: `webhook` / `sheets` outbox rows → their consumer, then the queued jobs of
 * `outbox` (webhook-dispatch, sheets-revoke) and `jobs` (sheets-backfill, account-data-export). `rounds` bounds the retries.
 */
export const work = async (app: TestApp, workspaceIds: string[], o: { rounds?: number; names?: string[] } = {}) => {
  const registry = app.app.get(ProcessorRegistry);
  const ran: string[] = [];
  for (let round = 0; round < (o.rounds ?? 30); round++) {
    const rows = (await db.outbox.findMany({
      where: { processedAt: null, topic: { in: ['webhook', 'notification', 'job'] }, OR: [{ workspaceId: { in: workspaceIds } }, { workspaceId: null, topic: 'job' }] },
      orderBy: { createdAt: 'asc' },
    })) as unknown as Row[];
    const mine = rows.filter((r) => r.topic !== 'job' || !o.names || o.names.includes(r.payload.name));
    if (!mine.length) break;
    for (const row of mine) {
      if (row.topic === 'job') {
        const handler = registry.handlers.get(row.payload.queue)?.get(row.payload.name);
        if (!handler) throw new Error(`no handler for ${row.payload.queue}/${row.payload.name}`);
        await TenantContext.runSystem(() => handler(row.payload.data, { id: row.key, name: row.payload.name, attemptsMade: 0, opts: row.payload.opts ?? {} } as never));
        ran.push(row.payload.name);
      } else {
        const handler = registry.outbox.get(row.topic);
        if (!handler) throw new Error(`no outbox handler for ${row.topic}`);
        await TenantContext.runSystem(() => handler(row));
      }
      await db.outbox.update({ where: { id: row.id }, data: { processedAt: new Date() } });
    }
  }
  return ran;
};

/** Pending `sheets` outbox rows of a workspace → `sheets-upsert` run at once (the 5 s debounce is the queue's delay). */
export const syncSheets = async (app: TestApp, workspaceId: string) => {
  const registry = app.app.get(ProcessorRegistry);
  const upsert = registry.handlers.get('outbox')!.get('sheets-upsert')!;
  const rows = await db.outbox.findMany({ where: { workspaceId, topic: 'sheets', processedAt: null }, orderBy: { createdAt: 'asc' } });
  const conn = await db.sheetsConnection.findUnique({ where: { workspaceId } });
  const done = new Set<string>();
  const out: unknown[] = [];
  for (const row of rows) {
    const orderId = (row.payload as { orderId: string }).orderId;
    await db.outbox.update({ where: { id: row.id }, data: { processedAt: new Date() } });
    if (!conn || done.has(orderId)) continue;
    done.add(orderId);
    out.push(await TenantContext.runSystem(() => upsert({ connectionId: conn.id, orderId, workspaceId }, { attemptsMade: 0, opts: { attempts: 5 } } as never)));
  }
  return out;
};

export const fakeGoogle = (app: TestApp): FakeSheetsGateway => {
  const f = app.app.get<FakeSheetsGateway | null>(FAKE_SHEETS);
  if (!f) throw new Error('tests must run with the simulated Google (SHEETS_DRIVER=fake)');
  return f;
};

/** Connects Google Sheets through the real OAuth routes and the simulated consent ("Autoriser"). */
export const connectSheets = async (app: TestApp, owner: Actor, email = 'marchand@gmail.com') => {
  const { url } = (await owner.get('/integrations/google-sheets/connect').expect(200)).body.data as { url: string };
  const state = new URL(url).searchParams.get('state')!;
  const code = `fake-code.${Buffer.from(email).toString('base64url')}`;
  const res = await request(app.http()).get(`/api/v1/integrations/google-sheets/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`).expect(302);
  return { location: String(res.headers.location), state };
};

/** Data rows (header excluded) of a simulated spreadsheet tab. */
export const sheetRows = async (app: TestApp, spreadsheetId: string, tab = 'Commandes') => {
  const s = await fakeGoogle(app).dump(spreadsheetId);
  return (s?.tabs[tab] ?? []).slice(1);
};

/** Request with an API key (`X-API-Key`). */
export const withKey = (app: TestApp, key: string) => {
  const call = (method: 'get' | 'post' | 'patch' | 'put' | 'delete') => (url: string, body?: object) => {
    const r = request(app.http())[method](`/api/v1${url}`).set('X-API-Key', key);
    return body ? r.send(body) : r;
  };
  return { get: call('get'), post: call('post'), patch: call('patch'), put: call('put'), delete: call('delete') };
};

export const pub = (app: TestApp) => request(app.http());
