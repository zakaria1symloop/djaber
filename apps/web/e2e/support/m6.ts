// Helpers of the M6 delivery e2e specs (couriers, send, overview, tracking, labels, public tracking page). Everything
// talks to the REAL API and worker with the `fake` courier driver (never a real courier): credentials containing
// `invalid` are refused, `down` makes the courier unavailable (503), a commune named `Inconnue…` is a courier
// validation error on the `commune` field (apps/api/src/modules/delivery/adapters/fake-courier.ts).
import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext } from '@playwright/test';
import { API, authHeaders, type Account } from './m1';
import { apiCall, communeOf, seedOrder, uniquePhone, type SeedOrder } from './m5-orders';

type Json = Record<string, unknown>;
export type Courier = { id: string; provider: string; displayName: string; isDefault: boolean; isActive: boolean };
export type Parcel = { id: string; orderId: string; status: string; trackingNumber: string | null; publicTrackingUrl: string; lastError: string | null; actions: { key: string; enabled: boolean; reasonCode?: string }[] };

/** True when the M6 delivery endpoints answer (the specs skip themselves otherwise, with the reason). */
export async function deliveryReady(request: APIRequestContext, a: Account): Promise<boolean> {
  try {
    const r = await request.get(`${API}/delivery/couriers/providers`, { headers: authHeaders(a), timeout: 5000 });
    return r.ok();
  } catch {
    return false;
  }
}

/** `POST /delivery/couriers` + connection test (fake driver). `token: 'down…'` = unreachable courier. */
export async function seedCourier(request: APIRequestContext, a: Account, o: { provider?: 'zrexpress' | 'ecotrack' | 'yalidine'; token?: string; isDefault?: boolean; test?: boolean } = {}): Promise<Courier> {
  const provider = o.provider ?? 'zrexpress';
  const token = o.token ?? `tok-${randomUUID().slice(0, 8)}`;
  const credentials = provider === 'zrexpress' ? { token, key: `key-${token}` } : provider === 'ecotrack' ? { baseUrl: `https://e2e${randomUUID().slice(0, 6)}.ecotrack.dz`, token } : { apiId: `id-${token}`, apiToken: token };
  const r = await apiCall<Courier>(request, a, 'POST', '/delivery/couriers', { provider, credentials, isDefault: o.isDefault ?? true, sender: { name: 'Boutique E2E', phone: '0550112233', wilayaId: 19, address: 'Cité 200 logements, Sétif' } });
  expect(r.status, `POST /delivery/couriers: ${JSON.stringify(r.error)}`).toBeLessThan(300);
  if (o.test !== false) await apiCall(request, a, 'POST', `/delivery/couriers/${r.data.id}/test`, {});
  return r.data;
}

/** A confirmed order with a delivery address (wilaya 16 by default) — ready to send. */
export async function confirmedOrder(request: APIRequestContext, a: Account, productId: string, o: { name?: string; wilayaId?: number } = {}): Promise<SeedOrder> {
  return seedOrder(request, a, { productId, status: 'confirmed', name: o.name, wilayaId: o.wilayaId });
}

/** A confirmed order whose commune is free text (`Inconnue …`): the fake courier refuses it on the `commune` field. */
export async function orderWithUnknownCommune(request: APIRequestContext, a: Account, productId: string): Promise<SeedOrder> {
  const r = await apiCall<SeedOrder>(
    request,
    a,
    'POST',
    '/orders',
    {
      client: { name: 'Sara Kaci', phone: uniquePhone() },
      items: [{ productId, quantity: 1 }],
      delivery: { wilayaId: 19, communeText: 'Inconnue Ouest', isStopdesk: false, address: 'Rue des Frères Bouchama, n° 8' },
      paymentMethod: 'cash',
      status: 'confirmed',
    },
    { 'Idempotency-Key': randomUUID() },
  );
  expect(r.status, `POST /orders: ${JSON.stringify(r.error)}`).toBeLessThan(300);
  return r.data;
}

/** `POST /orders/:id/shipments` (from the order address) and wait until the worker answered (not `pending`). */
export async function sendOrder(request: APIRequestContext, a: Account, orderId: string, courierAccountId?: string, o: { wait?: boolean } = {}): Promise<Parcel> {
  const order = await apiCall<{ address: { wilayaId: number; communeId: number | null; communeText: string | null; address: string | null; isStopdesk: boolean } }>(request, a, 'GET', `/orders/${orderId}`);
  const ad = order.data.address;
  const r = await apiCall<Parcel>(
    request,
    a,
    'POST',
    `/orders/${orderId}/shipments`,
    { ...(courierAccountId ? { courierAccountId } : {}), wilayaId: ad.wilayaId, communeId: ad.communeId, communeText: ad.communeId ? null : ad.communeText, address: ad.address, isStopdesk: ad.isStopdesk },
    { 'Idempotency-Key': randomUUID() },
  );
  expect(r.status, `POST /orders/:id/shipments: ${JSON.stringify(r.error)}`).toBeLessThan(300);
  return o.wait === false ? r.data : waitParcel(request, a, r.data.id);
}

export async function getParcel(request: APIRequestContext, a: Account, id: string): Promise<Parcel> {
  const r = await apiCall<Parcel>(request, a, 'GET', `/shipments/${id}`);
  expect(r.status).toBe(200);
  return r.data;
}
/** Waits until the parcel left `pending` (the worker called the fake courier). */
export async function waitParcel(request: APIRequestContext, a: Account, id: string, until: (p: Parcel) => boolean = (p) => p.status !== 'pending'): Promise<Parcel> {
  let last: Parcel | null = null;
  await expect
    .poll(
      async () => {
        last = await getParcel(request, a, id);
        return until(last);
      },
      { timeout: 60_000, intervals: [500, 1000, 2000] },
    )
    .toBe(true);
  return last!;
}

/** `POST /shipments/:id/mark-failed` (fixture: delivery attempt failed). */
export async function markFailed(request: APIRequestContext, a: Account, id: string, reason = 'unreachable') {
  const r = await apiCall(request, a, 'POST', `/shipments/${id}/mark-failed`, { reason } as Json);
  expect(r.status, `mark-failed: ${JSON.stringify(r.error)}`).toBeLessThan(300);
}

export { communeOf };
