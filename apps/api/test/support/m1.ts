// Helpers of the M1 suites: sign-up through the real endpoint, token-based actors, local mailbox, outbox → mail.
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { rawPrisma as db } from '@djaber/db';
import { CryptoService } from '../../src/core/crypto/crypto.service';
import { MailOutbox } from '../../src/core/mail/mail.outbox';
import { MailService } from '../../src/core/mail/mail.service';
import { RedisService } from '../../src/core/redis/redis.provider';
import type { Actor } from './actors';
import type { TestApp } from './app';

export const PASSWORD = 'Motdepasse-2026';
export const uniqEmail = (prefix = 'user') => `${prefix}-${randomUUID().slice(0, 10)}@test.local`;
export const api = (app: TestApp) => request(app.http());

/** Supertest helpers for an access token obtained from the real auth endpoints. */
export const withToken = (app: TestApp, token: string, workspaceId = '', userId = ''): Actor => {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (workspaceId) headers['X-Workspace-Id'] = workspaceId;
  const call = (method: 'get' | 'post' | 'patch' | 'put' | 'delete') => (url: string, body?: object) => {
    const r = request(app.http())[method](`/api/v1${url}`).set(headers);
    return body ? r.send(body) : r;
  };
  return { userId, workspaceId, token, headers, get: call('get'), post: call('post'), patch: call('patch'), put: call('put'), delete: call('delete') };
};

/** `djaber_rt` value of a response (web clients receive the refresh token only as a cookie). */
export const refreshCookie = (res: request.Response): string | undefined => {
  const raw = res.headers['set-cookie'] as unknown as string[] | string | undefined;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const c = list.find((x) => x.startsWith('djaber_rt='));
  return c ? decodeURIComponent(c.split(';')[0]!.slice('djaber_rt='.length)) : undefined;
};
export const cookieHeader = (res: request.Response) => {
  const raw = res.headers['set-cookie'] as unknown as string[] | string | undefined;
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).find((x) => x.startsWith('djaber_rt=')) ?? '';
};

const clearRate = async (app: TestApp, pattern: string) => {
  const redis = app.app.get(RedisService).client;
  const keys = await redis.keys(pattern);
  if (keys.length) await redis.del(...keys);
};

export type Registered = Actor & { email: string; password: string; cookie: string; res: request.Response };

/** POST /auth/register (web client). The per-IP sign-up limit is cleared first: every test shares 127.0.0.1. */
export const register = async (app: TestApp, over: Record<string, unknown> = {}): Promise<Registered> => {
  await clearRate(app, 'rl:auth-register:*');
  const email = (over.email as string | undefined) ?? uniqEmail();
  const password = (over.password as string | undefined) ?? PASSWORD;
  const res = await api(app)
    .post('/api/v1/auth/register')
    .send({ firstName: 'Amine', lastName: 'Benali', email, password, ...over });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  const user = res.body.data.user;
  const actor = withToken(app, res.body.data.accessToken, user.ownedWorkspaceId ?? user.memberships[0]?.workspaceId ?? '', user.id);
  return { ...actor, email, password, cookie: refreshCookie(res) ?? '', res };
};

export const login = (app: TestApp, email: string, password = PASSWORD, extra: Record<string, unknown> = {}) =>
  api(app).post('/api/v1/auth/login').send({ email, password, ...extra });

/** Gives a directly-created user (support/actors) a real password. */
export const setPassword = async (app: TestApp, userId: string, password = PASSWORD) => {
  await db.user.update({ where: { id: userId }, data: { passwordHash: await app.app.get(CryptoService).hashPassword(password) } });
};

/** Runs the `mail` side of the outbox synchronously: pending rows → `email-send` handler → local mailbox. */
export const drainMail = async (app: TestApp) => {
  const outbox = app.app.get(MailOutbox);
  const rows = await db.outbox.findMany({ where: { topic: 'mail', processedAt: null }, orderBy: { createdAt: 'asc' } });
  for (const row of rows) {
    await outbox.deliver(row.payload as never);
    await db.outbox.update({ where: { id: row.id }, data: { processedAt: new Date() } });
  }
  return rows.length;
};

export type Mail = { to: string; subject: string; html: string; template?: string; params?: Record<string, unknown>; locale?: string; at: string };

/** Mails received by an address (newest first), after draining the outbox. */
export const mailsTo = async (app: TestApp, to: string, template?: string): Promise<Mail[]> => {
  await drainMail(app);
  const all = (await app.app.get(MailService).localMailbox(to)) as Mail[];
  return template ? all.filter((m) => m.template === template) : all;
};

/** Token carried by the link of a mail (`?token=` query or last path segment). */
export const tokenOf = (mail: Mail | undefined): string => {
  const url = String(mail?.params?.url ?? '');
  const m = /[?&]token=([^&]+)/.exec(url);
  const token = m ? m[1]! : url.split('/').pop()!;
  if (!token) throw new Error('mail has no link');
  return decodeURIComponent(token);
};

/** Poll until `fn` returns a truthy value (audit rows are written right after the response). */
export const eventually = async <T>(fn: () => Promise<T>, timeoutMs = 3000): Promise<T> => {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (v || Date.now() - start > timeoutMs) return v;
    await new Promise((r) => setTimeout(r, 50));
  }
};

export { clearRate, db };
