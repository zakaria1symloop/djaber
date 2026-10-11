// Creates users / workspaces directly in the database and returns supertest helpers with the right headers.
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { rawPrisma as db, type MembershipRole } from '@djaber/db';
import { TokenService } from '../../src/core/auth/token.service';
import type { TestApp } from './app';

export type Actor = {
  userId: string;
  workspaceId: string;
  token: string;
  headers: Record<string, string>;
  get: (url: string) => request.Test;
  post: (url: string, body?: object) => request.Test;
  patch: (url: string, body?: object) => request.Test;
  put: (url: string, body?: object) => request.Test;
  delete: (url: string) => request.Test;
};

const uniq = () => randomUUID().slice(0, 8);

export const createUser = async (over: Partial<{ email: string; platformRole: string; emailVerified: boolean }> = {}) =>
  db.user.create({
    data: {
      email: over.email ?? `user-${uniq()}@test.local`,
      passwordHash: 'x',
      firstName: 'Test',
      lastName: 'User',
      platformRole: (over.platformRole ?? 'none') as never,
      emailVerifiedAt: over.emailVerified === false ? null : new Date(),
    },
  });

/** Workspace with an owner and a subscription on `planSlug` (default pro, active). */
export const createWorkspace = async (planSlug = 'pro') => {
  const owner = await createUser();
  const ws = await db.workspace.create({ data: { name: `Boutique ${uniq()}`, slug: `ws-${uniq()}` } });
  await db.user.update({ where: { id: owner.id }, data: { ownedWorkspaceId: ws.id } });
  await db.membership.create({ data: { workspaceId: ws.id, userId: owner.id, role: 'owner' } });
  const plan = await db.plan.findUniqueOrThrow({ where: { slug: planSlug } });
  await db.subscription.create({
    data: {
      workspaceId: ws.id,
      planId: plan.id,
      status: 'active',
      billingCycle: 'monthly',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400_000),
    },
  });
  return { ws, owner };
};

const actor = async (app: TestApp, userId: string, workspaceId: string, role?: string, platformRole = 'none'): Promise<Actor> => {
  const { token } = await app.app.get(TokenService).signAccess({ sub: userId, wid: workspaceId || undefined, role, pr: platformRole });
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (workspaceId) headers['X-Workspace-Id'] = workspaceId;
  const call = (method: 'get' | 'post' | 'patch' | 'put' | 'delete') => (url: string, body?: object) => {
    const r = request(app.http())[method](`/api/v1${url}`).set(headers);
    return body ? r.send(body) : r;
  };
  return { userId, workspaceId, token, headers, get: call('get'), post: call('post'), patch: call('patch'), put: call('put'), delete: call('delete') };
};

export const asOwner = async (app: TestApp, planSlug = 'pro') => {
  const { ws, owner } = await createWorkspace(planSlug);
  return actor(app, owner.id, ws.id, 'owner');
};

export const asMember = async (app: TestApp, workspaceId: string, role: MembershipRole, opts: { readOnly?: boolean } = {}) => {
  const user = await createUser();
  await db.membership.create({ data: { workspaceId, userId: user.id, role, readOnly: opts.readOnly ?? false } });
  return actor(app, user.id, workspaceId, role);
};
export const asAdmin = (app: TestApp, workspaceId: string) => asMember(app, workspaceId, 'admin');
export const asOperator = (app: TestApp, workspaceId: string) => asMember(app, workspaceId, 'operator');

export const asPlatform = async (app: TestApp, role = 'super_admin') => {
  const user = await createUser({ platformRole: role });
  return actor(app, user.id, '', undefined, role);
};

/** Authenticated user without any workspace. */
export const asLoneUser = async (app: TestApp) => {
  const user = await createUser();
  return actor(app, user.id, '');
};

export const anonymous = (app: TestApp) => ({
  get: (url: string) => request(app.http()).get(`/api/v1${url}`),
  post: (url: string, body?: object) => request(app.http()).post(`/api/v1${url}`).send(body ?? {}),
});
