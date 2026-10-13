// M11 — Google Sheets (03 §22 GSH-01…08, 05-integrations §3, FL-11, 03-events `sheets` / `sheets-upsert` / `sheets-backfill` /
// `sched-sheets-health`) against the simulated Google (SHEETS_DRIVER=fake): OAuth connect, pick / paste / create, header row,
// upsert by `djaber_id` (idempotent, survives a re-sort, re-appends a deleted row), filters, token revoked ⇒ error +
// `sheets.error`, backfill job, disconnect. AT-GSH-01.
import { asOperator, asOwner } from '../support/actors';
import { createTestApp, type TestApp } from '../support/app';
import { forbidNetwork } from '../support/m3';
import { newOrder, seedFees, status } from '../support/m5';
import { connectSheets, db, fakeGoogle, sheetRows, syncSheets, work } from '../support/m11';
import { SHEETS_HEADERS } from '@djaber/shared';

let app: TestApp;
let net: ReturnType<typeof forbidNetwork>;
beforeAll(async () => {
  app = await createTestApp();
  net = forbidNetwork();
});
afterAll(async () => {
  net.restore();
  await app.close();
});
type Owner = Awaited<ReturnType<typeof asOwner>>;
const shop = async (plan = 'pro') => {
  const owner = await asOwner(app, plan);
  await seedFees(app, owner.workspaceId);
  return owner;
};
const connectAndCreate = async (owner: Owner) => {
  await connectSheets(app, owner);
  return (await owner.put('/integrations/google-sheets', { createNew: true }).expect(200)).body.data as Record<string, any>;
};

describe('connect and choose the sheet (GSH-01 / GSH-02)', () => {
  it('connect ⇒ simulated consent ⇒ callback stores the encrypted token and redirects to the web; pick_sheet; create ⇒ header row (bold / frozen / R hidden); audit', async () => {
    const owner = await shop();
    const before = (await owner.get('/integrations/google-sheets').expect(200)).body.data;
    expect(before).toMatchObject({ state: 'not_connected', driver: 'fake', featureEnabled: true, verificationPending: true, actions: expect.arrayContaining([{ key: 'connect', enabled: true, primary: true }]) });
    const { url } = (await owner.get('/integrations/google-sheets/connect?returnTo=/settings/integrations/sheets').expect(200)).body.data;
    expect(url).toContain('/api/v1/dev/google/consent?state=');
    const consent = await (await import('supertest')).default(app.http()).get(new URL(url).pathname + new URL(url).search).expect(200);
    expect(consent.text).toContain('Autoriser');

    const { location } = await connectSheets(app, owner, 'amel@gmail.com');
    expect(location).toMatch(/\/settings\/integrations\/sheets\?sheets=connected$/);
    const row = await db.sheetsConnection.findUniqueOrThrow({ where: { workspaceId: owner.workspaceId } });
    expect(row).toMatchObject({ googleEmail: 'amel@gmail.com', spreadsheetId: null, status: 'active' });
    expect(Buffer.from(row.refreshToken).toString('utf8')).not.toContain('fake-rt-');
    expect((await owner.get('/integrations/google-sheets').expect(200)).body.data).toMatchObject({ state: 'pick_sheet', googleEmail: 'amel@gmail.com' });

    const created = (await owner.put('/integrations/google-sheets', { createNew: true }).expect(200)).body.data;
    expect(created).toMatchObject({ state: 'active', sheetName: 'Commandes', spreadsheetTitle: expect.stringContaining('Djaber · Commandes'), spreadsheetUrl: expect.stringContaining('/spreadsheets/d/') });
    expect(created.columns).toEqual(SHEETS_HEADERS.fr.slice(0, 17));
    const sheet = await fakeGoogle(app).dump(created.spreadsheetId);
    expect(sheet!.tabs.Commandes![0]).toEqual([...SHEETS_HEADERS.fr]);
    expect(sheet!.hiddenR).toContain('Commandes');
    const audit = (await db.auditLog.findMany({ where: { workspaceId: owner.workspaceId, entity: 'SheetsConnection' }, select: { action: true } })).map((a) => a.action).sort();
    expect(audit).toEqual(['sheets.choose_sheet', 'sheets.connect']);
  });

  it('pasted URL / Picker id; unknown sheet ⇒ SHEETS_SPREADSHEET_NOT_FOUND; picker token lists the simulated files; filters only; two sources ⇒ 422', async () => {
    const owner = await shop();
    await connectSheets(app, owner, 'karim@gmail.com');
    const seeded = await fakeGoogle(app).seedSpreadsheet('karim@gmail.com', 'Ventes 2026');
    const picker = (await owner.post('/integrations/google-sheets/picker-token', {}).expect(200)).body.data;
    expect(picker).toMatchObject({ driver: 'fake', accessToken: expect.stringMatching(/^fake-at-/), files: [{ id: seeded.id, name: 'Ventes 2026' }] });
    const byUrl = (await owner.put('/integrations/google-sheets', { spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${seeded.id}/edit#gid=0` }).expect(200)).body.data;
    expect(byUrl).toMatchObject({ spreadsheetId: seeded.id, spreadsheetTitle: 'Ventes 2026', state: 'active' });
    expect((await fakeGoogle(app).dump(seeded.id))!.tabs.Commandes![0]).toEqual([...SHEETS_HEADERS.fr]);
    expect((await owner.put('/integrations/google-sheets', { spreadsheetId: 'fakeDoesNotExist0000000000000' }).expect(404)).body.error.code).toBe('SHEETS_SPREADSHEET_NOT_FOUND');
    expect((await owner.put('/integrations/google-sheets', { spreadsheetUrl: 'https://example.com/not-a-sheet' }).expect(422)).body.error.code).toBe('VALIDATION_ERROR');
    expect((await owner.put('/integrations/google-sheets', { createNew: true, spreadsheetId: seeded.id }).expect(422)).body.error.code).toBe('VALIDATION_ERROR');
    const filtered = (await owner.put('/integrations/google-sheets', { filters: { sources: ['ai', 'manual'] } }).expect(200)).body.data;
    expect(filtered).toMatchObject({ spreadsheetId: seeded.id, filters: { channelIds: [], sources: ['ai', 'manual'] } });
    expect((await owner.put('/integrations/google-sheets', { filters: { channelIds: ['00000000-0000-4000-8000-000000000000'] } }).expect(422)).body.error.code).toBe('VALIDATION_ERROR');
  });

  it('403 Operator; plan without google_sheets ⇒ PLAN_FEATURE_REQUIRED; not connected ⇒ SHEETS_NOT_CONNECTED; cross-workspace state is invisible', async () => {
    const owner = await shop();
    const op = await asOperator(app, owner.workspaceId);
    expect((await op.get('/integrations/google-sheets').expect(403)).body.error.code).toBe('FORBIDDEN');
    expect((await op.put('/integrations/google-sheets', { createNew: true }).expect(403)).body.error.code).toBe('FORBIDDEN');
    const free = await asOwner(app, 'free');
    expect((await free.get('/integrations/google-sheets/connect').expect(403)).body.error).toMatchObject({ code: 'PLAN_FEATURE_REQUIRED', params: { feature: 'google_sheets' } });
    expect((await owner.put('/integrations/google-sheets', { createNew: true }).expect(422)).body.error.code).toBe('SHEETS_NOT_CONNECTED');
    expect((await owner.post('/integrations/google-sheets/backfill', { from: '2026-10-01', to: '2026-10-13' }).expect(422)).body.error.code).toBe('SHEETS_NOT_CONNECTED');
    await connectAndCreate(owner);
    const other = await shop();
    expect((await other.get('/integrations/google-sheets').expect(200)).body.data.state).toBe('not_connected');
    // a forged / expired OAuth state never connects anything
    const res = await (await import('supertest')).default(app.http()).get('/api/v1/integrations/google-sheets/callback?code=fake-code.eA&state=forged').expect(302);
    expect(res.headers.location).toContain('sheets=error&code=SHEETS_NOT_CONNECTED');
  });
});

describe('row upsert (GSH-04)', () => {
  it('AT-GSH-01 order created ⇒ row appended (debounced job); status change ⇒ same row updated even after the sheet was re-sorted; replay ⇒ no duplicate; token revoked ⇒ status error + sheets.error', async () => {
    const owner = await shop();
    const conn = await connectAndCreate(owner);
    const { order: a } = await newOrder(owner);
    const { order: b } = await newOrder(owner);
    expect(await syncSheets(app, owner.workspaceId)).toEqual([{ outcome: 'appended' }, { outcome: 'appended' }]);
    let rows = await sheetRows(app, conn.spreadsheetId);
    expect(rows.map((r) => r[17])).toEqual([a.id, b.id]);
    expect(rows[0]!.slice(0, 5)).toEqual([a.number, expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/), '—', a.clientName, `'${a.clientPhone}`]);
    expect(rows[0]![13]).toBe('NOUVELLE');
    expect((await owner.get(`/orders/${a.id}`).expect(200)).body.data.sheetsSynced).toBe(true);

    await fakeGoogle(app).shuffle(conn.spreadsheetId, 'Commandes');
    rows = await sheetRows(app, conn.spreadsheetId);
    expect(rows.map((r) => r[17])).toEqual([b.id, a.id]);
    await status(owner, a, 'confirmed').expect(200);
    expect(await syncSheets(app, owner.workspaceId)).toEqual([{ outcome: 'updated' }]);
    rows = await sheetRows(app, conn.spreadsheetId);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r[17] === a.id)![13]).toBe('CONFIRMÉE');

    // the same job run twice writes the same row (idempotent)
    const upsert = app.app.get(require('../../src/core/queue/processor.registry').ProcessorRegistry).handlers.get('outbox').get('sheets-upsert');
    const c = await db.sheetsConnection.findUniqueOrThrow({ where: { workspaceId: owner.workspaceId } });
    await upsert({ connectionId: c.id, orderId: a.id, workspaceId: owner.workspaceId });
    await upsert({ connectionId: c.id, orderId: a.id, workspaceId: owner.workspaceId });
    expect(await sheetRows(app, conn.spreadsheetId)).toHaveLength(2);
    expect(await db.sheetsRow.count({ where: { connectionId: c.id } })).toBe(2);

    // a row deleted by hand in the sheet is re-appended on the next update (FL-11)
    const idx = (await sheetRows(app, conn.spreadsheetId)).findIndex((r) => r[17] === b.id);
    await fakeGoogle(app).deleteRow(conn.spreadsheetId, 'Commandes', idx + 2);
    expect(await upsert({ connectionId: c.id, orderId: b.id, workspaceId: owner.workspaceId })).toEqual({ outcome: 'appended' });
    expect((await sheetRows(app, conn.spreadsheetId)).filter((r) => r[17] === b.id)).toHaveLength(1);

    // token revoked ⇒ error at once (no retry), sheets.error to Owner / Admin, card in error with reconnect
    await fakeGoogle(app).revokeAccount('marchand@gmail.com');
    await status(owner, b, 'confirmed').expect(200);
    expect(await syncSheets(app, owner.workspaceId)).toEqual([{ outcome: 'error', code: 'SHEETS_TOKEN_REVOKED' }]);
    await work(app, [owner.workspaceId]);
    const view = (await owner.get('/integrations/google-sheets').expect(200)).body.data;
    expect(view).toMatchObject({ state: 'error', lastError: { code: 'SHEETS_TOKEN_REVOKED', message: expect.any(String) } });
    expect(view.actions.find((x: any) => x.key === 'reconnect')).toMatchObject({ enabled: true });
    expect(await db.notification.count({ where: { workspaceId: owner.workspaceId, type: 'sheets_error' } })).toBe(1);
    // while in error the debounced rows are not scheduled
    await status(owner, (await owner.get(`/orders/${a.id}`).expect(200)).body.data, 'preparing').expect(200);
    const scheduledBefore = await db.outbox.count({ where: { workspaceId: owner.workspaceId, topic: 'sheets', processedAt: null } });
    expect(scheduledBefore).toBeGreaterThan(0);

    // reconnect (same Google account) ⇒ same sheet, active again
    await connectSheets(app, owner);
    expect((await owner.get('/integrations/google-sheets').expect(200)).body.data).toMatchObject({ state: 'active', spreadsheetId: conn.spreadsheetId, lastError: null });
  });

  it('filters (GSH-06): non-matching orders are skipped; spreadsheet deleted ⇒ SHEETS_SPREADSHEET_NOT_FOUND; quota ⇒ retried; health cron restores', async () => {
    const owner = await shop();
    const conn = await connectAndCreate(owner);
    await owner.put('/integrations/google-sheets', { filters: { sources: ['ai'] } }).expect(200);
    await newOrder(owner);
    expect(await syncSheets(app, owner.workspaceId)).toEqual([{ outcome: 'skipped' }]);
    await owner.put('/integrations/google-sheets', { filters: { sources: [] } }).expect(200);

    const { order } = await newOrder(owner);
    await fakeGoogle(app).failNext('marchand@gmail.com', 'quota');
    const upsert = app.app.get(require('../../src/core/queue/processor.registry').ProcessorRegistry).handlers.get('outbox').get('sheets-upsert');
    const c = await db.sheetsConnection.findUniqueOrThrow({ where: { workspaceId: owner.workspaceId } });
    await expect(upsert({ connectionId: c.id, orderId: order.id, workspaceId: owner.workspaceId }, { attemptsMade: 0, opts: { attempts: 5 } })).rejects.toThrow(/quota/);
    expect((await db.sheetsConnection.findUniqueOrThrow({ where: { id: c.id } })).status).toBe('active');
    expect(await upsert({ connectionId: c.id, orderId: order.id, workspaceId: owner.workspaceId }, { attemptsMade: 1, opts: { attempts: 5 } })).toEqual({ outcome: 'appended' });

    await fakeGoogle(app).deleteSpreadsheet(conn.spreadsheetId);
    expect(await upsert({ connectionId: c.id, orderId: order.id, workspaceId: owner.workspaceId })).toEqual({ outcome: 'error', code: 'SHEETS_SPREADSHEET_NOT_FOUND' });
    expect((await owner.get('/integrations/google-sheets/status').expect(200)).body.data).toMatchObject({ state: 'error', lastError: { code: 'SHEETS_SPREADSHEET_NOT_FOUND' } });

    // the merchant picks another sheet ⇒ active; the hourly health check also heals a transient error
    await owner.put('/integrations/google-sheets', { createNew: true }).expect(200);
    await db.sheetsConnection.update({ where: { id: c.id }, data: { status: 'error', lastError: 'INTERNAL' } });
    const cron = app.app.get(require('../../src/core/queue/processor.registry').ProcessorRegistry).crons.find((x: any) => x.name === 'sched-sheets-health');
    const health = await cron.handler();
    expect(health).toMatchObject({ healed: 1 });
    expect((await db.sheetsConnection.findUniqueOrThrow({ where: { id: c.id } })).status).toBe('active');
  });
});

describe('debounce (GSH-04: 5 s after the last change)', () => {
  it('the `sheets` outbox row schedules one delayed `sheets-upsert` per order (job id sheets:<orderId>, 5 s); a newer change moves it; no connection ⇒ nothing', async () => {
    const owner = await shop();
    const { order } = await newOrder(owner);
    const registry = app.app.get(require('../../src/core/queue/processor.registry').ProcessorRegistry);
    const queue = app.app.get(require('../../src/core/queue/queue.service').QueueService).queue('outbox');
    const row = await db.outbox.findFirstOrThrow({ where: { workspaceId: owner.workspaceId, topic: 'sheets' } });
    await registry.outbox.get('sheets')(row);
    expect(await queue.getJob(`sheets_${order.id}`)).toBeUndefined();
    await connectAndCreate(owner);
    await registry.outbox.get('sheets')(row);
    const job = await queue.getJob(`sheets_${order.id}`);
    expect(job).toMatchObject({ name: 'sheets-upsert', opts: expect.objectContaining({ delay: 5000, attempts: 5 }) });
    expect(await job!.getState()).toBe('delayed');
    await registry.outbox.get('sheets')(row);
    expect((await queue.getJobs(['delayed'])).filter((j: any) => j.id === `sheets_${order.id}`)).toHaveLength(1);
    await job!.remove();
  });
});

describe('backfill (GSH-05) and disconnect', () => {
  it('backfill { from, to } ⇒ 202 job; orders of the range written in order (existing rows updated, others appended); second call while running reuses the job; range > 732 d refused', async () => {
    const owner = await shop();
    const conn = await connectAndCreate(owner);
    const made: Record<string, any>[] = [];
    for (let i = 0; i < 3; i++) made.push((await newOrder(owner)).order);
    await db.order.update({ where: { id: made[0]!.id }, data: { orderedAt: new Date('2025-01-05T10:00:00Z') } });
    await syncSheets(app, owner.workspaceId); // rows already written by the live sync
    await db.outbox.updateMany({ where: { workspaceId: owner.workspaceId, topic: 'sheets' }, data: { processedAt: new Date() } });
    const today = new Date().toISOString().slice(0, 10);
    const { jobId } = (await owner.post('/integrations/google-sheets/backfill', { from: '2026-01-01', to: today }).expect(202)).body.data;
    expect((await owner.post('/integrations/google-sheets/backfill', { from: '2026-01-01', to: today }).expect(202)).body.data.jobId).toBe(jobId);
    expect((await owner.get('/integrations/google-sheets').expect(200)).body.data.backfill).toMatchObject({ jobId, status: 'queued' });
    await work(app, [owner.workspaceId], { names: ['sheets-backfill'] });
    const job = (await owner.get(`/jobs/${jobId}`).expect(200)).body.data;
    expect(job).toMatchObject({ status: 'done', kind: 'backfill', result: { total: 2, written: 2 } });
    const rows = await sheetRows(app, conn.spreadsheetId);
    expect(rows.filter((r) => r[17] === made[1]!.id)).toHaveLength(1);
    expect(rows).toHaveLength(3);
    expect((await owner.post('/integrations/google-sheets/backfill', { from: '2020-01-01', to: '2026-01-10' }).expect(422)).body.error.code).toBe('REPORT_RANGE_TOO_LONG');
    expect((await owner.post('/integrations/google-sheets/backfill', { from: '2026-02-01', to: '2026-01-01' }).expect(422)).body.error.code).toBe('VALIDATION_ERROR');
  });

  it('disconnect ⇒ connection deleted, Google token revoked by the worker, sheet untouched; a new order is not synced', async () => {
    const owner = await shop();
    const conn = await connectAndCreate(owner);
    await newOrder(owner);
    await syncSheets(app, owner.workspaceId);
    const view = (await owner.delete('/integrations/google-sheets').expect(200)).body.data;
    expect(view.state).toBe('not_connected');
    expect(await db.sheetsConnection.count({ where: { workspaceId: owner.workspaceId } })).toBe(0);
    expect(await work(app, [owner.workspaceId], { names: ['sheets-revoke'] })).toContain('sheets-revoke');
    expect(await sheetRows(app, conn.spreadsheetId)).toHaveLength(1);
    await newOrder(owner);
    expect(await syncSheets(app, owner.workspaceId)).toEqual([]);
    expect(await db.auditLog.count({ where: { workspaceId: owner.workspaceId, action: 'sheets.disconnect' } })).toBe(1);
  });
});
