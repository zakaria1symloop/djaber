// Helpers of the M10 merchant help / status / safety specs (real API on :4010, fake drivers only).
// A platform admin is a normal account with 2FA enabled whose `User.platformRole` is set in the development database
// (contract-a "e2e: create platform users directly in DB"); its token carries the platform role after a fresh login.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { expect, type APIRequestContext } from '@playwright/test';
import { API, authHeaders, createAccount, freshTotp, totp, type Account } from './m1';

export type PlatformRole = 'super_admin' | 'support' | 'moderator' | 'finance' | 'read';
export type Admin = Account & { secret: string; role: PlatformRole };

const DB_URL = process.env.E2E_DATABASE_URL ?? 'postgresql://djaber:djaber@localhost:54329/djaber';

/** Raw SQL on the development database (Prisma client of packages/db, no tenant extension). */
export async function sql(query: string, ...params: unknown[]): Promise<number> {
  const require = createRequire(resolve(__dirname, '../../../../packages/db/package.json'));
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient({ datasourceUrl: DB_URL });
  try {
    return await db.$executeRawUnsafe(query, ...params);
  } finally {
    await db.$disconnect();
  }
}

const json = async <T>(r: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> => {
  const body = await r.json().catch(() => null);
  expect(r.ok(), `${r.url()} → ${r.status()} ${JSON.stringify(body)}`).toBeTruthy();
  return (body as { data: T }).data;
};

/** Creates a platform admin of `role`: account → 2FA enabled → platformRole in DB → fresh login through the 2FA step. */
export async function platformAdmin(request: APIRequestContext, role: PlatformRole = 'super_admin', prefix = 'm10adm'): Promise<Admin> {
  const a = await createAccount(request, { prefix: `${prefix}-${role}`, finishOnboarding: true });
  const setup = await json<{ secret: string }>(await request.post(`${API}/auth/2fa/setup`, { headers: authHeaders(a), data: {} }));
  await json(await request.post(`${API}/auth/2fa/enable`, { headers: authHeaders(a), data: { code: totp(setup.secret) } }));
  await sql(`UPDATE "User" SET "platformRole" = $1::"PlatformRole" WHERE "email" = $2`, role, a.email);
  const login = await json<{ mfaToken?: string; accessToken?: string }>(await request.post(`${API}/auth/login`, { data: { email: a.email, password: a.password } }));
  expect(login.mfaToken, 'login of a 2FA account answers an mfaToken').toBeTruthy();
  // the enabling code and the verify code may fall in the same 30 s window: the API refuses a replayed code
  await new Promise((r) => setTimeout(r, 30_000 - (Date.now() % 30_000) + 300));
  const tokens = await json<{ accessToken: string }>(await request.post(`${API}/auth/2fa/verify`, { data: { mfaToken: login.mfaToken, code: await freshTotp(setup.secret) } }));
  return { ...a, accessToken: tokens.accessToken, secret: setup.secret, role };
}

export const adminHeaders = (a: Pick<Account, 'accessToken'>) => ({ Authorization: `Bearer ${a.accessToken}`, 'Accept-Language': 'fr' });

export async function adminPost<T = unknown>(request: APIRequestContext, a: Admin, path: string, data: unknown = {}): Promise<T> {
  return json<T>(await request.post(`${API}${path}`, { headers: adminHeaders(a), data }));
}
export async function adminPut<T = unknown>(request: APIRequestContext, a: Admin, path: string, data: unknown = {}): Promise<T> {
  return json<T>(await request.put(`${API}${path}`, { headers: adminHeaders(a), data }));
}

/** `POST /support/tickets` as the merchant. */
export async function createTicket(request: APIRequestContext, a: Account, o: { category?: string; message?: string; priority?: 'normal' | 'urgent' } = {}) {
  return json<{ id: string; number: string }>(
    await request.post(`${API}/support/tickets`, {
      headers: authHeaders(a),
      data: { category: o.category ?? 'integrations', priority: o.priority ?? 'normal', message: o.message ?? 'Depuis hier les commandes n’arrivent plus dans ma feuille Google Sheets.', context: { page: '/settings' } },
    }),
  );
}

/** True when the merchant HELP routes of M10 answer (`GET /support/tickets`). */
export async function helpReady(request: APIRequestContext, a: Account): Promise<boolean> {
  return (await request.get(`${API}/support/tickets`, { headers: authHeaders(a) })).ok();
}

export const statusReady = async (request: APIRequestContext): Promise<boolean> => (await request.get(`${API}/status`)).ok();
