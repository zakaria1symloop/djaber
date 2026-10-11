// Helpers of the M1 e2e specs. They talk to the real API of this repo (dev drivers only: file mailbox, no provider).
// Sign-ups are rate limited (20 / h / IP): each spec file creates as few accounts as it can.
import { createHmac, randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { clearRateLimits } from './global-setup';

export const API = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4010'}/api/v1`;
export const PASSWORD = 'Passw0rd123';
const MAIL_DIR = resolve(__dirname, '../../../../.local/mail');

export const uniqueEmail = (prefix: string) => `e2e.${prefix}.${Date.now().toString(36)}${randomUUID().slice(0, 6)}@example.com`;

export type Account = { email: string; password: string; firstName: string; lastName: string; accessToken: string; workspaceId: string | null };

/** True when the M1 API answers; specs skip themselves (with the reason) when it does not. */
export async function apiReady(request: APIRequestContext): Promise<boolean> {
  try {
    return (await request.get(API.replace('/api/v1', '/health'), { timeout: 3000 })).ok();
  } catch {
    return false;
  }
}

/** Creates an account through the API. `finishOnboarding` writes step 99 so the app opens on Home. */
export async function createAccount(request: APIRequestContext, o: { prefix: string; firstName?: string; finishOnboarding?: boolean; invitationToken?: string }): Promise<Account> {
  const reused = await reuseAccount(request, o);
  if (reused) return reused;
  const account = await registerAccount(request, o);
  if (REUSE) saveAccount(o.prefix, account);
  return account;
}

/**
 * Local debugging only (`E2E_REUSE=1`): accounts are kept in the git-ignored `.local/e2e-accounts.json` and logged in
 * again on the next run, so repeated runs stay under the sign-up rate limit. The onboarding state is put back first.
 */
const REUSE = process.env.E2E_REUSE === '1';
const ACCOUNTS_FILE = resolve(__dirname, '../../../../.local/e2e-accounts.json');
const readAccounts = (): Record<string, Account> => {
  try {
    return JSON.parse(readFileSync(ACCOUNTS_FILE, 'utf8')) as Record<string, Account>;
  } catch {
    return {};
  }
};
const saveAccount = (prefix: string, a: Account) => writeFileSync(ACCOUNTS_FILE, JSON.stringify({ ...readAccounts(), [prefix]: { ...a, accessToken: '' } }, null, 1));
async function reuseAccount(request: APIRequestContext, o: { prefix: string; finishOnboarding?: boolean }): Promise<Account | null> {
  const saved = REUSE ? readAccounts()[o.prefix] : undefined;
  if (!saved) return null;
  const res = await request.post(`${API}/auth/login`, { data: { email: saved.email, password: saved.password } });
  if (!res.ok()) return null;
  const { data } = (await res.json()) as { data: { accessToken?: string } };
  if (!data.accessToken) return null; // 2FA was enabled on it: a new account is needed
  const account = { ...saved, accessToken: data.accessToken };
  if (account.workspaceId) {
    await request.patch(`${API}/workspace/onboarding`, { headers: authHeaders(account), data: { step: o.finishOnboarding ? 99 : 1 } });
    await request.patch(`${API}/workspace`, { headers: authHeaders(account), data: { stockMode: 'simple' } });
  }
  return account;
}

async function registerAccount(request: APIRequestContext, o: { prefix: string; firstName?: string; finishOnboarding?: boolean; invitationToken?: string }): Promise<Account> {
  const email = uniqueEmail(o.prefix);
  const firstName = o.firstName ?? 'Amel';
  const register = () =>
    request.post(`${API}/auth/register`, {
      data: { firstName, lastName: 'Benali', email, password: PASSWORD, locale: 'fr', ...(o.invitationToken ? { invitationToken: o.invitationToken } : {}) },
    });
  let res = await register();
  // sign-ups are limited to 20 / h / IP and the whole suite creates more accounts than that from one machine:
  // the counters of the local dev Redis are cleared (as global-setup does before the run) and the call is repeated once
  if (res.status() === 429) {
    await clearRateLimits();
    res = await register();
  }
  expect(res.status(), `register ${email}: ${await res.text()}`).toBeLessThan(300);
  const { data } = (await res.json()) as { data: { accessToken: string; user: { ownedWorkspaceId: string | null } } };
  const account: Account = { email, password: PASSWORD, firstName, lastName: 'Benali', accessToken: data.accessToken, workspaceId: data.user.ownedWorkspaceId };
  if (o.finishOnboarding && account.workspaceId) {
    const r = await request.patch(`${API}/workspace/onboarding`, { headers: authHeaders(account), data: { step: 99 } });
    expect(r.ok(), await r.text()).toBeTruthy();
  }
  return account;
}

const globToRegExp = (glob: string): RegExp =>
  new RegExp(
    `^${glob
      .split('**')
      .map((part) => part.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*'))
      .join('.*')}$`,
  );
/**
 * Waits for the address of a navigation. The app navigates on the client (history API) and prefetched links change the
 * URL inside the click itself: `page.waitForURL` then waits for a navigation event that has already fired. The URL is
 * polled instead (web-first assertion).
 */
export async function expectUrl(page: Page, url: string | RegExp, o: { timeout?: number } = {}) {
  await expect(page).toHaveURL(typeof url === 'string' ? globToRegExp(url) : url, { timeout: o.timeout ?? 30_000 });
}

export const authHeaders = (a: Pick<Account, 'accessToken' | 'workspaceId'>) => ({
  Authorization: `Bearer ${a.accessToken}`,
  ...(a.workspaceId ? { 'X-Workspace-Id': a.workspaceId } : {}),
});

export async function login(page: Page, a: { email: string; password: string }, locale = 'fr') {
  await page.goto(`/${locale}/login`);
  await page.locator('#email').fill(a.email);
  await page.locator('#password').fill(a.password);
  await page.locator('form button[type=submit]').click();
}

export async function loginHome(page: Page, a: { email: string; password: string }, locale = 'fr') {
  await login(page, a, locale);
  await expectUrl(page, `**/${locale}/home`);
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: /Menu utilisateur/ }).click();
  await page.getByRole('menuitem', { name: 'Déconnexion', exact: true }).click();
  await expectUrl(page, '**/login**');
}

type Mail = { to: string; template: string; subject: string; text: string; params: Record<string, unknown>; at: string };

/** Newest message of the dev mailbox (`.local/mail`, one JSON file per message) for a recipient and a template. */
export async function waitForMail(to: string, template: RegExp, o: { after?: number; timeoutMs?: number } = {}): Promise<Mail> {
  const deadline = Date.now() + (o.timeoutMs ?? 20_000);
  for (;;) {
    if (existsSync(MAIL_DIR)) {
      const found = readdirSync(MAIL_DIR)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, 400)
        .map((f) => {
          try {
            return JSON.parse(readFileSync(resolve(MAIL_DIR, f), 'utf8')) as Mail;
          } catch {
            return null; // a file still being written
          }
        })
        .find((m) => m && m.to === to && template.test(m.template) && (!o.after || Date.parse(m.at) >= o.after));
      if (found) return found;
    }
    if (Date.now() > deadline) throw new Error(`no mail ${template} for ${to} in ${MAIL_DIR} (is the worker running?)`);
    await new Promise((r) => setTimeout(r, 400));
  }
}

/** Path + query of the link carried by a mail (`params.url`), without the origin. */
export const mailLink = (m: Mail): string => {
  const raw = Object.values(m.params).find((v) => typeof v === 'string' && /^https?:\/\//.test(v)) as string | undefined;
  if (!raw) throw new Error(`no link in mail ${m.template}`);
  const u = new URL(raw);
  return u.pathname + u.search;
};

/* ---------- TOTP (RFC 6238, SHA-1, 6 digits, 30 s) for the 2FA flows ---------- */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const base32Decode = (s: string): Buffer => {
  let bits = '';
  for (const c of s.replace(/[\s=]/g, '').toUpperCase()) bits += B32.indexOf(c).toString(2).padStart(5, '0');
  const bytes = bits.match(/.{8}/g) ?? [];
  return Buffer.from(bytes.map((b) => parseInt(b, 2)));
};
export const totp = (secret: string, at = Date.now()): string => {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const h = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const o = h[h.length - 1]! & 0xf;
  const code = ((h[o]! & 0x7f) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
  return String(code % 1_000_000).padStart(6, '0');
};
/** A code that stays valid for at least a few seconds (waits for the next window when the current one is ending). */
export async function freshTotp(secret: string): Promise<string> {
  const left = 30_000 - (Date.now() % 30_000);
  if (left < 4_000) await new Promise((r) => setTimeout(r, left + 300));
  return totp(secret);
}
