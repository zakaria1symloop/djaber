// Creates a demo shop for team testing on a running local stack (API + worker): owner + admin + operator accounts,
// categories, products with stock, two connected (simulated) Facebook pages, an active AI agent and a few customer
// conversations answered by the simulated AI. Fake drivers only — nothing leaves this machine.
// Usage: node tools/demo-data.mjs [apiBaseUrl]   → writes the accounts to .local/demo-accounts.md (git-ignored)
import { randomBytes } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { Client } = createRequire(resolve(root, 'package.json'))('pg');
const API = `${process.argv[2] ?? 'http://localhost:4010'}/api/v1`;
const stamp = Date.now().toString(36);
const pass = () => `Demo-${randomBytes(5).toString('hex')}1`;

const call = async (method, path, token, body, extra = {}) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  const json = await res.json().catch(() => null);
  if (res.status >= 400) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json?.error ?? json).slice(0, 300)}`);
  return json?.data;
};
const db = new Client(process.env.DATABASE_URL ?? 'postgresql://djaber:djaber@localhost:54329/djaber');
await db.connect();
const verify = (email) => db.query('UPDATE "User" SET "emailVerifiedAt" = now() WHERE email = $1', [email]);

// --- owner + shop
const owner = { email: `amel.${stamp}@demo.djaber.local`, password: pass() };
const reg = await call('POST', '/auth/register', null, { firstName: 'Amel', lastName: 'Boutique', email: owner.email, password: owner.password, locale: 'fr' });
await verify(owner.email);
const T = reg.accessToken;
await call('PATCH', '/workspace/onboarding', T, { step: 99 });
const ws = await call('GET', '/workspace', T);
await call('PATCH', '/workspace', T, { name: 'Boutique Amel', version: ws.version, senderWilayaId: 16 }).catch(() => undefined);

// --- catalogue
const cats = {};
for (const name of ['Robes', 'Abayas', 'Accessoires', 'Cosmétiques']) cats[name] = (await call('POST', '/categories', T, { name })).id;
const products = [
  ['Robe satin', 'Robes', 4900, 2600, 14],
  ['Robe lin été', 'Robes', 3900, 1900, 3],
  ['Abaya noire brodée', 'Abayas', 6900, 3800, 22],
  ['Abaya beige', 'Abayas', 5900, 3200, 0],
  ['Sac cuir camel', 'Accessoires', 9800, 5400, 7],
  ['Foulard soie', 'Accessoires', 2400, 900, 41],
  ['Crème visage argan', 'Cosmétiques', 1800, 700, 88],
  ['Huile capillaire 100 ml', 'Cosmétiques', 1200, 450, 120],
];
for (const [name, cat, price, costPrice, stock] of products) {
  await call('POST', '/products', T, { name, price, costPrice, stock, minStock: 5, categoryId: cats[cat] });
}

// --- simulated pages (fake Meta connect flow) + agent
const start = await call('GET', '/channels/connect/facebook', T);
await fetch(start.url, { redirect: 'manual' });
const channels = await call('GET', '/channels', T);
let agentId = null;
try {
  const agent = await call('POST', '/agents', T, { presetKey: 'vendeur-pro', name: 'Amel — vendeuse' });
  agentId = agent.id;
  for (const ch of channels.filter((c) => c.status === 'active')) await call('PUT', `/channels/${ch.id}/agent`, T, { agentId }).catch(() => undefined);
  await call('POST', `/agents/${agentId}/activate`, T, {}).catch((e) => console.warn('agent not activated:', e.message));
} catch (e) {
  console.warn('agent step skipped:', e.message);
}

// --- customer conversations (answered by the simulated AI through the worker)
const fb = channels.find((c) => c.status === 'active');
if (fb) {
  const msgs = [
    ['100000000001', 'Salam, la robe satin est disponible ?'],
    ['100000000001', 'chhal le prix ?'],
    ['100000000002', 'Bonjour, livraison vers Oran combien ?'],
    ['100000000003', 'السلام عليكم، بشحال العباية السوداء؟'],
    ['100000000004', 'je veux parler à un humain svp'],
  ];
  for (const [senderId, text] of msgs) {
    await call('POST', '/dev/meta/inbound', T, { channelId: fb.id, senderId, text });
    await new Promise((r) => setTimeout(r, 1200));
  }
}

// --- teammates
const team = [];
for (const [role, firstName] of [['admin', 'Nadia'], ['operator', 'Yacine']]) {
  const m = { role, email: `${firstName.toLowerCase()}.${stamp}@demo.djaber.local`, password: pass() };
  const inv = await call('POST', '/workspace/invitations', T, { email: m.email, role }).catch((e) => (console.warn(e.message), null));
  if (inv) {
    // the invitation link lands in the local mailbox (mail driver `file`) once the worker has sent it
    let token = null;
    for (let i = 0; i < 25 && !token; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      for (const f of readdirSync(resolve(root, '.local/mail')).sort().reverse().slice(0, 60)) {
        const mail = JSON.parse(readFileSync(resolve(root, '.local/mail', f), 'utf8'));
        const hit = mail.to === m.email && /invitations\/([A-Za-z0-9_-]+)/.exec(mail.html ?? '');
        if (hit) { token = hit[1]; break; }
      }
    }
    if (!token) console.warn('invitation mail not found for', m.role);
    // sign-up through the invitation joins the shop without creating a workspace of their own
    const r2 = await call('POST', '/auth/register', null, { firstName, lastName: 'Demo', email: m.email, password: m.password, locale: 'fr', ...(token ? { invitationToken: token } : {}) }).catch((e) => (console.warn(e.message), null));
    if (r2) await verify(m.email);
  }
  team.push(m);
}
await db.end();

mkdirSync(resolve(root, '.local'), { recursive: true });
const web = (process.argv[2] ?? 'http://localhost:4010').replace(':4010', ':3010');
writeFileSync(
  resolve(root, '.local/demo-accounts.md'),
  `# Demo accounts (${new Date().toISOString()})\n\nOpen ${web}/fr/login\n\n| role | e-mail | password |\n|---|---|---|\n| owner (Boutique Amel) | ${owner.email} | ${owner.password} |\n${team
    .map((m) => `| ${m.role} | ${m.email} | ${m.password} |`)
    .join('\n')}\n\nEverything is simulated: Facebook pages, customers, AI answers, e-mails (written to .local/mail).\n`,
);
console.log(`demo shop ready: ${products.length} products, ${channels.length} pages, agent ${agentId ? 'created' : 'missing'}, ${team.length} teammates`);
console.log('accounts written to .local/demo-accounts.md');
