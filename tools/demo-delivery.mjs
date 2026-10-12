// Adds a courier account and parcels to the demo shop made by tools/demo-data.mjs + tools/demo-orders.mjs (owner account
// read from .local/demo-accounts.md). The API must run with COURIER_DRIVER=fake: the "credentials" below are placeholders
// understood only by the fake courier — no parcel is ever created at a real courier.
// Usage: node tools/demo-delivery.mjs [apiBaseUrl]
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
let accounts = await call('GET', '/delivery/couriers', T);
let zr = accounts.find((a) => a.provider === 'zrexpress');
if (!zr) {
  zr = await call('POST', '/delivery/couriers', T, {
    provider: 'zrexpress',
    displayName: 'ZR Express',
    isDefault: true,
    credentials: { token: 'demo-fake-token-0001', key: 'demo-fake-key-0001' },
    sender: { name: 'Boutique Amel', phone: '0550123456', address: 'Rue Didouche Mourad n° 12', wilayaId: 16 },
  });
  await call('POST', `/delivery/couriers/${zr.id}/test`, T, {}).catch((e) => console.warn('test:', e.message));
}
if (!accounts.some((a) => a.provider === 'yalidine')) {
  const y = await call('POST', '/delivery/couriers', T, { provider: 'yalidine', displayName: 'Yalidine', credentials: { apiId: 'demo-fake-id-0001', apiToken: 'demo-fake-token-0001' } });
  await call('POST', `/delivery/couriers/${y.id}/test`, T, {}).catch((e) => console.warn('test:', e.message));
}

// send every confirmed order that has no parcel yet, one by one (each order keeps its own address)
const orders = await call('GET', '/orders?status=confirmed&pageSize=50', T);
let sent = 0;
for (const o of orders) {
  const full = await call('GET', `/orders/${o.id}`, T);
  const d = full.address ?? {};
  if (full.shipment || !d.wilayaId) continue;
  await call('POST', `/orders/${o.id}/shipments`, T, { courierAccountId: zr.id, wilayaId: d.wilayaId, communeId: d.communeId ?? null, communeText: d.communeText ?? null, address: d.address ?? null, isStopdesk: !!d.isStopdesk })
    .then(() => sent++)
    .catch((e) => console.warn('send:', e.message));
}
console.log(`demo delivery ready: couriers ZR Express + Yalidine (fake), ${sent} parcels sent`);
