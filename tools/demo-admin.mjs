// Creates a platform admin (super_admin) for team testing on a running local stack: a normal account with 2FA enabled
// whose `User.platformRole` is set in the development database (same recipe as the M10 e2e helpers). The password and the
// 2FA secret (with its otpauth:// link for an authenticator app) are appended to the git-ignored .local/demo-accounts.md.
// Usage: node tools/demo-admin.mjs [apiBaseUrl]
import { createHmac, randomBytes } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { Client } = createRequire(resolve(root, 'package.json'))('pg');
const API = `${process.argv[2] ?? 'http://localhost:4010'}/api/v1`;
const stamp = Date.now().toString(36);

const call = async (method, path, token, body) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (res.status >= 400) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json?.error ?? json).slice(0, 300)}`);
  return json?.data;
};
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const totp = (secret, at = Date.now()) => {
  let bits = '';
  for (const c of secret.replace(/[\s=]/g, '').toUpperCase()) bits += B32.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const h = createHmac('sha1', key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return String((((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1_000_000).padStart(6, '0');
};

const email = `platform.${stamp}@demo.djaber.local`;
const password = `Demo-${randomBytes(5).toString('hex')}1`;
const db = new Client(process.env.DATABASE_URL ?? 'postgresql://djaber:djaber@localhost:54329/djaber');
await db.connect();
const reg = await call('POST', '/auth/register', null, { firstName: 'Samir', lastName: 'Plateforme', email, password, locale: 'fr' });
await db.query('UPDATE "User" SET "emailVerifiedAt" = now() WHERE email = $1', [email]);
await call('PATCH', '/workspace/onboarding', reg.accessToken, { step: 99 }).catch(() => undefined);
const setup = await call('POST', '/auth/2fa/setup', reg.accessToken, {});
await call('POST', '/auth/2fa/enable', reg.accessToken, { code: totp(setup.secret) });
await db.query('UPDATE "User" SET "platformRole" = $1::"PlatformRole" WHERE email = $2', ['super_admin', email]);
await db.end();
const otpauth = `otpauth://totp/Djaber%20(dev):${encodeURIComponent(email)}?secret=${setup.secret}&issuer=Djaber%20dev`;
appendFileSync(
  resolve(root, '.local/demo-accounts.md'),
  `\n## Platform admin (super_admin, 2FA) — created ${new Date().toISOString()}\n\n| role | email | password |\n|---|---|---|\n| platform super_admin | ${email} | ${password} |\n\n2FA secret (add to Google Authenticator / Authy / 1Password with "enter a setup key", time-based): \`${setup.secret}\`\n\notpauth link: \`${otpauth}\`\n\nAdmin URL: /fr/admin\n`,
);
console.log(`platform admin ready: ${email} (password + 2FA secret in .local/demo-accounts.md)`);
