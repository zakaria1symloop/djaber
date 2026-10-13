// Helpers of the M10 ops & safety suites (moderation, safety): platform actors with 2FA, platform-level outbox drain.
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { rawPrisma as db, TenantContext } from '@djaber/db';
import { TokenService } from '../../src/core/auth/token.service';
import { ProcessorRegistry } from '../../src/core/queue/processor.registry';
import type { TestApp } from './app';

export type PlatformActorT = {
  userId: string;
  role: string;
  get: (url: string) => request.Test;
  post: (url: string, body?: object) => request.Test;
  patch: (url: string, body?: object) => request.Test;
  put: (url: string, body?: object) => request.Test;
  delete: (url: string, body?: object) => request.Test;
};

/** Platform user of `role` with 2FA on (D41: every platform role must have 2FA). */
export const platformUser = async (app: TestApp, role: string): Promise<PlatformActorT> => {
  const user = await db.user.create({
    data: { email: `pf-${role}-${randomUUID().slice(0, 8)}@djaber.ai`, passwordHash: 'x', firstName: 'Admin', lastName: role, platformRole: role as never, totpEnabled: true, emailVerifiedAt: new Date() },
  });
  const { token } = await app.app.get(TokenService).signAccess({ sub: user.id, pr: role });
  const headers = { Authorization: `Bearer ${token}` };
  const call = (method: 'get' | 'post' | 'patch' | 'put' | 'delete') => (url: string, body?: object) => {
    const r = request(app.http())[method](`/api/v1${url}`).set(headers);
    return body ? r.send(body) : r;
  };
  return { userId: user.id, role, get: call('get'), post: call('post'), patch: call('patch'), put: call('put'), delete: call('delete') };
};

export const PLATFORM_ROLES = ['super_admin', 'support', 'moderator', 'finance', 'read'] as const;

/** Runs pending outbox rows (all workspaces, incl. platform rows with no workspace) like the worker does. */
export const drainAll = async (app: TestApp, topics = ['job', 'notification', 'webhook']) => {
  const registry = app.app.get(ProcessorRegistry);
  const ran: string[] = [];
  for (let round = 0; round < 20; round++) {
    const rows = await db.outbox.findMany({ where: { processedAt: null, topic: { in: topics } }, orderBy: { createdAt: 'asc' } });
    if (!rows.length) break;
    for (const row of rows as any[]) {
      if (row.topic === 'job') {
        const handler = registry.handlers.get(row.payload.queue)?.get(row.payload.name);
        if (handler) {
          await TenantContext.runSystem(() => handler(row.payload.data, { id: row.key, name: row.payload.name, attemptsMade: 0 } as never));
          ran.push(row.payload.name);
        }
      } else {
        const handler = registry.outbox.get(row.topic);
        if (handler) await TenantContext.runSystem(() => handler(row));
      }
      await db.outbox.update({ where: { id: row.id }, data: { processedAt: new Date() } });
    }
  }
  return ran;
};

/** WS events written to the outbox for a room (newest last). */
export const roomEvents = async (room: string, event: string) =>
  (await db.outbox.findMany({ where: { topic: 'ws' }, orderBy: { createdAt: 'asc' } }))
    .map((r) => r.payload as { room: string; event: string; payload: any })
    .filter((p) => p.room === room && p.event === event);

export const auditRows = (action: string, entityId?: string) => db.auditLog.findMany({ where: { action, ...(entityId ? { entityId } : {}) }, orderBy: { at: 'desc' } });

export const setTrust = (workspaceId: string, trustLevel: 'new' | 'standard' | 'trusted' | 'watch') => db.workspace.update({ where: { id: workspaceId }, data: { trustLevel } });

let seq = 0;
export const phone = () => `05${String(50000000 + (Date.now() % 40000000) + ++seq).slice(0, 8)}`;
