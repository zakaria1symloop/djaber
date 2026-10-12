// Adds clients and orders in several states to the demo shop made by tools/demo-data.mjs (owner account read from
// .local/demo-accounts.md). Fake drivers only — no message, payment or parcel leaves this machine.
// Usage: node tools/demo-orders.mjs [apiBaseUrl]
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = `${process.argv[2] ?? 'http://localhost:4010'}/api/v1`;
const md = readFileSync(resolve(root, '.local/demo-accounts.md'), 'utf8');
const [, email, password] = /^\| owner[^|]*\| (\S+) \| (\S+) \|$/m.exec(md) ?? [];
if (!email) throw new Error('run tools/demo-data.mjs first');

const call = async (method, path, token, body) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (res.status >= 400) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json?.error ?? json).slice(0, 300)}`);
  return json?.data;
};

const T = (await call('POST', '/auth/login', null, { email, password })).accessToken;
const products = await call('GET', '/products?pageSize=50', T);
const byName = Object.fromEntries(products.map((p) => [p.name, p.id]));
const clients = [
  ['Sara Benali', '0551234567', 16, 'Bab Ezzouar', 'Cité 200 logements, bât. 12'],
  ['Karim Haddad', '0661987654', 31, 'Oran', 'Rue Larbi Ben Mhidi n° 45'],
  ['Lina Ouali', '0770112233', 25, 'Constantine', 'Cité Daksi, bloc 3, porte 8'],
  ['Mourad Saidi', '0558445566', 9, 'Ouled Yaich', 'Lotissement 120, villa 14'],
  ['Yasmine Kaci', '0699001122', 15, 'Tizi Ouzou', 'Nouvelle ville, près de la poste'],
  ['Nassim Belkacem', '0662334455', 19, 'El Eulma', 'Cité 1014 logements, bât. C'],
];
const plan = [
  [0, [['Robe satin', 1], ['Foulard soie', 2]], 'new'],
  [1, [['Abaya noire brodée', 1]], 'new'],
  [2, [['Crème visage argan', 2], ['Huile capillaire 100 ml', 1]], 'confirmed'],
  [3, [['Sac cuir camel', 1]], 'confirmed'],
  [4, [['Robe lin été', 1]], 'confirmed', 'delivered'],
  [5, [['Foulard soie', 1], ['Crème visage argan', 1]], 'new', 'cancelled'],
  [0, [['Huile capillaire 100 ml', 3]], 'confirmed', 'delivered'],
  [1, [['Abaya noire brodée', 1], ['Foulard soie', 1]], 'new'],
];
let made = 0;
for (const [ci, items, status, then] of plan) {
  const [name, phone, wilayaId, communeText, address] = clients[ci];
  const order = await call('POST', '/orders', T, {
    client: { name, phone },
    items: items.map(([p, quantity]) => ({ productId: byName[p], quantity })),
    delivery: { wilayaId, communeText, isStopdesk: false, address },
    status,
  }).catch((e) => (console.warn(e.message), null));
  if (!order) continue;
  made++;
  if (then === 'delivered') await call('POST', `/orders/${order.id}/deliver`, T, {}).catch((e) => console.warn('deliver:', e.message));
  if (then === 'cancelled') await call('POST', `/orders/${order.id}/cancel`, T, { reason: 'changed_mind' }).catch((e) => console.warn('cancel:', e.message));
}
console.log(`demo orders ready: ${made} orders for ${clients.length} clients`);
