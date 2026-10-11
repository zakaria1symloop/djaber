// M0 exit criteria: /health, error envelope for every code, cross-workspace 404 harness, permission pipeline, idempotency.
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import request from 'supertest';
import { prisma, rawPrisma } from '@djaber/db';
import { ERROR_CODES, ERROR_MESSAGES, type ErrorCode } from '@djaber/shared';
import { Audited, Authenticated, Idempotent, Platform, Public, RateLimit, RequirePermission, RequirePlatformRole } from '../../src/core/auth/decorators';
import { AppException, notFound } from '../../src/core/errors/app.exception';
import { createTestApp, type TestApp } from '../support/app';
import { anonymous, asAdmin, asLoneUser, asMember, asOperator, asOwner, asPlatform } from '../support/actors';

let counter = 0;

@Controller('_test')
class HarnessController {
  @Public()
  @Get('throw/:code')
  throwCode(@Param('code') code: string) {
    const def = ERROR_CODES[code as ErrorCode];
    const params = Object.fromEntries((def.params as readonly string[]).map((p) => [p.replace('[]', ''), 7]));
    throw new AppException(code as ErrorCode, params);
  }

  @Public()
  @Get('boom')
  boom() {
    throw new Error('secret internal detail');
  }

  @Get('quick-replies')
  @RequirePermission('workspace.read')
  list() {
    return prisma.quickReply.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  @Get('quick-replies/:id')
  @RequirePermission('workspace.read')
  async one(@Param('id') id: string) {
    const row = await prisma.quickReply.findFirst({ where: { id } });
    if (!row) throw notFound();
    return row;
  }

  @Post('quick-replies')
  @RequirePermission('workspace.settings')
  @Idempotent({ required: true })
  @Audited({ entity: 'QuickReply', action: 'quick_reply.create', idFrom: 'result.id' })
  create(@Body() body: { title: string }) {
    counter++;
    return prisma.quickReply.create({ data: { title: body.title, body: 'b' } as never });
  }

  @Get('me')
  @Authenticated()
  me() {
    return { ok: true };
  }

  @Get('admin')
  @Platform()
  @RequirePlatformRole('admin.billing.write')
  admin() {
    return { ok: true };
  }

  @Public()
  @RateLimit({ name: 'test-limit', max: 2, windowSeconds: 60, by: 'ip' })
  @Get('limited')
  limited() {
    return { ok: true };
  }
}

describe('M0 — HTTP pipeline', () => {
  let app: TestApp;
  beforeAll(async () => {
    app = await createTestApp({ controllers: [HarnessController] });
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /health and /ready answer 200', async () => {
    const h = await request(app.http()).get('/health');
    expect(h.status).toBe(200);
    expect(h.body.status).toBe('ok');
    const r = await request(app.http()).get('/ready');
    expect(r.status).toBe(200);
    expect(r.body.checks).toEqual({ db: true, redis: true, storage: true });
  });

  it('GET /app/version is public and computes forceUpdate', async () => {
    const r = await anonymous(app).get('/app/version?platform=android&version=0.9.0');
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ minVersion: '1.0.0', forceUpdate: true, recommendUpdate: false, maintenance: null });
    const ok = await anonymous(app).get('/app/version?platform=ios&version=1.0.0');
    expect(ok.body.data.forceUpdate).toBe(false);
    const bad = await anonymous(app).get('/app/version?platform=windows');
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
    expect(bad.body.error.fields.platform).toBeDefined();
  });

  it('seeds: 58 wilayas, communes, 7 system units, 3 plans, 3 packs, 4 presets', async () => {
    const w = await anonymous(app).get('/geo/wilayas');
    expect(w.body.data).toHaveLength(58);
    const c = await anonymous(app).get('/geo/wilayas/16/communes');
    expect(c.body.data.length).toBeGreaterThan(40);
    expect(await rawPrisma.unit.count({ where: { isSystem: true } })).toBe(7);
    expect(await rawPrisma.plan.count()).toBe(3);
    expect(await rawPrisma.creditPack.count()).toBe(3);
    expect(await rawPrisma.agentPreset.count({ where: { status: 'published' } })).toBe(4);
    expect(await rawPrisma.appVersion.count()).toBe(2);
  });

  describe('error envelope (11-error-catalogue)', () => {
    const codes = Object.keys(ERROR_CODES) as ErrorCode[];

    it.each(codes)('%s has the documented status and a message in fr / ar / en', async (code) => {
      for (const locale of ['fr', 'ar', 'en'] as const) {
        const r = await anonymous(app).get(`/_test/throw/${code}`).set('Accept-Language', locale);
        expect(r.status).toBe(ERROR_CODES[code].status || 400);
        expect(Object.keys(r.body)).toEqual(['error']);
        expect(Object.keys(r.body.error).sort()).toEqual(['code', 'details', 'fields', 'message', 'params', 'ref']);
        expect(r.body.error.code).toBe(code);
        expect(r.body.error.ref).toBe(r.headers['x-request-id']);
        expect(typeof r.body.error.message).toBe('string');
        expect(r.body.error.message.length).toBeGreaterThan(0);
        expect(r.body.error.message).not.toBe(code); // a catalogue entry exists
        expect(r.body.error.message).not.toMatch(/\{\w+\}/); // every placeholder was interpolated
        expect(ERROR_MESSAGES[locale][code]).toBeDefined();
      }
    });

    it('statuses of the whole catalogue (snapshot)', () => {
      expect(Object.fromEntries(codes.map((c) => [c, ERROR_CODES[c].status]))).toMatchSnapshot();
    });

    it('unknown errors become 500 INTERNAL without leaking details', async () => {
      const r = await anonymous(app).get('/_test/boom');
      expect(r.status).toBe(500);
      expect(r.body.error.code).toBe('INTERNAL');
      expect(JSON.stringify(r.body)).not.toContain('secret internal detail');
    });

    it('unknown route is 404 NOT_FOUND in the requested language', async () => {
      const r = await anonymous(app).get('/nope').set('Accept-Language', 'ar');
      expect(r.status).toBe(404);
      expect(r.body.error.message).toBe(ERROR_MESSAGES.ar.NOT_FOUND);
    });
  });

  describe('authentication and tenancy', () => {
    it('401 without a token, 401 with a bad token', async () => {
      expect((await anonymous(app).get('/_test/quick-replies')).status).toBe(401);
      const r = await anonymous(app).get('/_test/quick-replies').set('Authorization', 'Bearer not-a-token');
      expect(r.status).toBe(401);
      expect(r.body.error.code).toBe('UNAUTHORIZED');
    });

    it('cross-workspace access answers 404 and never leaks rows', async () => {
      const a = await asOwner(app);
      const b = await asOwner(app);
      const rowB = await rawPrisma.quickReply.create({ data: { workspaceId: b.workspaceId, title: 'B only', body: 'x' } });
      await rawPrisma.quickReply.create({ data: { workspaceId: a.workspaceId, title: 'A only', body: 'x' } });

      const list = await a.get('/_test/quick-replies');
      expect(list.status).toBe(200);
      expect(list.body.data.map((r: { title: string }) => r.title)).toEqual(['A only']);

      const direct = await a.get(`/_test/quick-replies/${rowB.id}`);
      expect(direct.status).toBe(404);
      expect(direct.body.error.code).toBe('NOT_FOUND');

      // forging the header of a workspace the user is not a member of
      const forged = await a.get(`/_test/quick-replies/${rowB.id}`).set('X-Workspace-Id', b.workspaceId);
      expect(forged.status).toBe(404);
      const garbage = await a.get('/_test/quick-replies').set('X-Workspace-Id', 'not-a-uuid');
      expect(garbage.status).toBe(404);
    });

    it('missing X-Workspace-Id falls back to the owned workspace; a user without workspace gets WORKSPACE_REQUIRED', async () => {
      const a = await asOwner(app);
      const r = await request(app.http()).get('/api/v1/_test/quick-replies').set('Authorization', a.headers.Authorization!);
      expect(r.status).toBe(200);
      const lone = await asLoneUser(app);
      const l = await lone.get('/_test/quick-replies');
      expect(l.status).toBe(400);
      expect(l.body.error.code).toBe('WORKSPACE_REQUIRED');
      expect((await lone.get('/_test/me')).status).toBe(200);
    });

    it('suspended workspace is blocked with WORKSPACE_SUSPENDED', async () => {
      const a = await asOwner(app);
      await rawPrisma.workspace.update({ where: { id: a.workspaceId }, data: { status: 'suspended', suspendedAt: new Date() } });
      const r = await a.get('/_test/quick-replies');
      expect(r.status).toBe(403);
      expect(r.body.error.code).toBe('WORKSPACE_SUSPENDED');
    });
  });

  describe('permissions', () => {
    it('role matrix: operator cannot use an Admin+ permission; read-only member cannot mutate', async () => {
      const owner = await asOwner(app);
      const operator = await asOperator(app, owner.workspaceId);
      const admin = await asAdmin(app, owner.workspaceId);
      const readOnly = await asMember(app, owner.workspaceId, 'admin', { readOnly: true });

      expect((await operator.get('/_test/quick-replies')).status).toBe(200);
      const denied = await operator.post('/_test/quick-replies', { title: 't1' }).set('Idempotency-Key', 'k-op');
      expect(denied.status).toBe(403);
      expect(denied.body.error.code).toBe('FORBIDDEN');

      const ro = await readOnly.post('/_test/quick-replies', { title: 't2' }).set('Idempotency-Key', 'k-ro');
      expect(ro.status).toBe(403);
      expect(ro.body.error.code).toBe('READ_ONLY_MEMBER');
      expect((await readOnly.get('/_test/quick-replies')).status).toBe(200);

      const ok = await admin.post('/_test/quick-replies', { title: 't3' }).set('Idempotency-Key', 'k-admin');
      expect(ok.status).toBe(201);
    });

    it('platform routes need the platform role of the key', async () => {
      const owner = await asOwner(app);
      expect((await owner.get('/_test/admin')).status).toBe(403);
      expect((await (await asPlatform(app, 'support')).get('/_test/admin')).status).toBe(403);
      expect((await (await asPlatform(app, 'finance')).get('/_test/admin')).status).toBe(200);
      expect((await (await asPlatform(app, 'super_admin')).get('/_test/admin')).status).toBe(200);
    });
  });

  describe('idempotency, audit, rate limit', () => {
    it('requires the key, replays the same response, rejects a different body', async () => {
      const a = await asOwner(app);
      const missing = await a.post('/_test/quick-replies', { title: 'x' });
      expect(missing.status).toBe(400);
      expect(missing.body.error.code).toBe('IDEMPOTENCY_KEY_MISSING');

      const before = counter;
      const first = await a.post('/_test/quick-replies', { title: 'once' }).set('Idempotency-Key', 'idem-1');
      expect(first.status).toBe(201);
      const replay = await a.post('/_test/quick-replies', { title: 'once' }).set('Idempotency-Key', 'idem-1');
      expect(replay.status).toBe(201);
      expect(replay.headers['idempotent-replayed']).toBe('true');
      expect(replay.body).toEqual(first.body);
      expect(counter).toBe(before + 1);
      expect(await rawPrisma.quickReply.count({ where: { workspaceId: a.workspaceId } })).toBe(1);

      const mismatch = await a.post('/_test/quick-replies', { title: 'other' }).set('Idempotency-Key', 'idem-1');
      expect(mismatch.status).toBe(ERROR_CODES.IDEMPOTENCY_MISMATCH.status);
      expect(mismatch.body.error.code).toBe('IDEMPOTENCY_MISMATCH');

      // audit row written by @Audited
      await new Promise((r) => setTimeout(r, 200));
      const audit = await rawPrisma.auditLog.findFirst({ where: { workspaceId: a.workspaceId, action: 'quick_reply.create' } });
      expect(audit).toMatchObject({ entity: 'QuickReply', entityId: first.body.data.id, actorId: a.userId, actorRole: 'owner' });
    });

    it('rate limit answers 429 RATE_LIMITED with Retry-After', async () => {
      await anonymous(app).get('/_test/limited');
      await anonymous(app).get('/_test/limited');
      const r = await anonymous(app).get('/_test/limited');
      expect(r.status).toBe(429);
      expect(r.body.error.code).toBe('RATE_LIMITED');
      expect(Number(r.headers['retry-after'])).toBeGreaterThan(0);
    });
  });
});
