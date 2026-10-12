// 05-integrations §2.4 — Yalidine live driver [V1 delivery.service.ts]: parcels, batch tracking ≤ 50, label (URL fetched
// and returned as PDF bytes), stop-desks (`centers`), rates (`fees`, first row), cancel before pickup, webhooks
// (`parcel_status_updated`, `X-Yalidine-Secret` equality).
import { timingSafeEqual } from 'node:crypto';
import { courierDate, checkStatus, fieldOfMessage, num, str, type CourierTransport } from './http';
import { CourierError, PROVIDER_CAPABILITIES, type AnyCredentials, type CourierAdapter, type CreateShipmentInput, type Stopdesk, type TestResult, type TrackResult, type WebhookEvent } from './courier-adapter';
import { mapCourierStatus } from './status-maps';

export const YALIDINE_BASE = 'https://api.yalidine.app/v1';

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Pure webhook parser (shared by the live and the fake driver). `null` = signature invalid. */
export const parseYalidineWebhook = (headers: Record<string, string | string[] | undefined>, rawBody: Buffer, secret: string | null): WebhookEvent[] | null => {
  const given = headers['x-yalidine-secret'];
  const value = Array.isArray(given) ? given[0] : given;
  if (!secret || !value || !safeEqual(String(value), secret)) return null;
  let body: unknown;
  try {
    body = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return [];
  }
  const events = (body as { events?: unknown[] } | null)?.events;
  if (!Array.isArray(events)) return [];
  return events
    .map((e) => {
      const d = ((e as { data?: unknown })?.data ?? e) as Record<string, unknown>;
      return { trackingNumber: str(d.tracking), rawStatus: str(d.status ?? d.last_status), at: courierDate(d.date_status ?? (e as Record<string, unknown>).occurred_at) };
    })
    .filter((e) => e.trackingNumber && e.rawStatus);
};

export class YalidineAdapter implements CourierAdapter {
  readonly provider = 'yalidine' as const;
  readonly driver = 'live' as const;
  readonly capabilities = PROVIDER_CAPABILITIES.yalidine;
  constructor(private readonly http: CourierTransport) {}

  private headers(c: AnyCredentials) {
    return { 'X-API-ID': str(c.apiId), 'X-API-TOKEN': str(c.apiToken), Accept: 'application/json' };
  }

  async testCredentials(c: AnyCredentials): Promise<TestResult> {
    const t0 = Date.now();
    try {
      const res = checkStatus(await this.http({ method: 'GET', url: `${YALIDINE_BASE}/wilayas/`, headers: this.headers(c) }));
      const data = (res.json as { data?: unknown[] } | null)?.data;
      if (res.status === 200 && Array.isArray(data)) return { ok: true, latencyMs: Date.now() - t0, wilayasServed: data.length };
      return { ok: false, code: 'COURIER_CREDENTIALS_INVALID', message: `HTTP ${res.status}`, latencyMs: Date.now() - t0 };
    } catch (e) {
      if (e instanceof CourierError) return { ok: false, code: e.kind === 'auth' ? 'COURIER_CREDENTIALS_INVALID' : 'COURIER_UNAVAILABLE', message: e.message, latencyMs: Date.now() - t0 };
      throw e;
    }
  }

  async createShipment(c: AnyCredentials, input: CreateShipmentInput) {
    const body = [
      {
        order_id: input.orderNumber,
        from_wilaya_name: input.sender.wilayaName,
        firstname: input.recipient.name,
        familyname: '',
        contact_phone: input.recipient.phone,
        address: input.address,
        to_commune_name: input.communeCode || input.communeName,
        to_wilaya_name: input.wilayaName,
        product_list: input.productSummary,
        price: input.codAmount,
        do_insurance: false,
        declared_value: input.declaredValue ?? 0,
        length: 0,
        width: 0,
        height: 0,
        weight: Math.max(1, Math.ceil((input.weightGrams ?? 500) / 1000)),
        freeshipping: false,
        is_stopdesk: input.isStopdesk,
        stopdesk_id: input.stopdeskId ?? '',
        has_exchange: false,
        product_to_collect: null,
      },
    ];
    const res = checkStatus(await this.http({ method: 'POST', url: `${YALIDINE_BASE}/parcels/`, headers: this.headers(c), body }));
    const j = (res.json ?? {}) as Record<string, unknown>;
    const holder = (j.data && typeof j.data === 'object' ? j.data : j) as Record<string, Record<string, unknown>>;
    const row = holder[input.orderNumber] ?? Object.values(holder)[0];
    if (!row) throw new CourierError('unavailable', 'empty answer');
    if (!(row.success === true || row.success === 'true')) {
      const message = str(row.message) || 'refused';
      throw new CourierError('validation', message, fieldOfMessage(message));
    }
    return { trackingNumber: str(row.tracking), externalId: str(row.import_id) || null, labelUrl: str(row.label) || null, rawStatus: 'En préparation', raw: row };
  }

  private toTrack(row: Record<string, unknown>): TrackResult {
    const rawStatus = str(row.last_status);
    const m = mapCourierStatus('yalidine', rawStatus);
    return { trackingNumber: str(row.tracking), rawStatus, mapped: m?.mapped ?? null, failureReason: m?.failureReason ?? null, at: courierDate(row.date_last_status), location: str(row.current_center_name ?? row.to_commune_name) || null, description: m?.failureReason === 'other' ? rawStatus : null, raw: row };
  }

  async track(c: AnyCredentials, trackingNumber: string): Promise<TrackResult> {
    const res = checkStatus(await this.http({ method: 'GET', url: `${YALIDINE_BASE}/parcels/${encodeURIComponent(trackingNumber)}`, headers: this.headers(c) }), { notFound: true });
    const row = ((res.json as { data?: Record<string, unknown>[] } | null)?.data ?? [])[0];
    if (!row) throw new CourierError('not_found', 'unknown tracking');
    return this.toTrack(row);
  }

  async trackMany(c: AnyCredentials, trackingNumbers: string[]): Promise<TrackResult[]> {
    const res = checkStatus(await this.http({ method: 'GET', url: `${YALIDINE_BASE}/parcels/?tracking=${trackingNumbers.map(encodeURIComponent).join(',')}`, headers: this.headers(c) }));
    return ((res.json as { data?: Record<string, unknown>[] } | null)?.data ?? []).filter((r) => str(r.tracking) && str(r.last_status)).map((r) => this.toTrack(r));
  }

  async getLabel(c: AnyCredentials, trackingNumber: string, labelUrl?: string | null) {
    let url = labelUrl ?? null;
    if (!url) {
      const res = checkStatus(await this.http({ method: 'GET', url: `${YALIDINE_BASE}/parcels/${encodeURIComponent(trackingNumber)}`, headers: this.headers(c) }), { notFound: true });
      url = str(((res.json as { data?: Record<string, unknown>[] } | null)?.data ?? [])[0]?.label) || null;
    }
    if (!url || !/^https:\/\//.test(url)) throw new CourierError('label_unavailable', 'no label');
    const pdf = checkStatus(await this.http({ method: 'GET', url, headers: { Accept: 'application/pdf' } }));
    if (pdf.status !== 200 || pdf.bytes.subarray(0, 5).toString('latin1') !== '%PDF-') throw new CourierError('label_unavailable', `HTTP ${pdf.status}`);
    return { pdf: pdf.bytes };
  }

  async listStopdesks(c: AnyCredentials, wilayaId: number): Promise<Stopdesk[]> {
    const res = checkStatus(await this.http({ method: 'GET', url: `${YALIDINE_BASE}/centers/?wilaya_id=${wilayaId}`, headers: this.headers(c) }));
    return ((res.json as { data?: Record<string, unknown>[] } | null)?.data ?? []).map((r) => ({ id: str(r.center_id), name: str(r.name), wilayaId, communeName: str(r.commune_name), address: str(r.address) || null }));
  }

  async getRates(c: AnyCredentials, fromWilayaId: number, toWilayaId: number) {
    const res = checkStatus(await this.http({ method: 'GET', url: `${YALIDINE_BASE}/fees/?from_wilaya_id=${fromWilayaId}&to_wilaya_id=${toWilayaId}`, headers: this.headers(c) }));
    const row = ((res.json as { data?: Record<string, unknown>[] } | null)?.data ?? [])[0];
    return row ? { home: num(row.home_fee), stopdesk: num(row.desk_fee) } : null;
  }

  async cancel(c: AnyCredentials, trackingNumber: string) {
    const res = checkStatus(await this.http({ method: 'DELETE', url: `${YALIDINE_BASE}/parcels/${encodeURIComponent(trackingNumber)}`, headers: this.headers(c) }));
    if (res.status >= 400) throw new CourierError('cancel_not_allowed', `HTTP ${res.status}`);
    return { ok: true, rawStatus: 'Supprimé' };
  }

  parseWebhook(headers: Record<string, string | string[] | undefined>, rawBody: Buffer, secret: string | null) {
    return parseYalidineWebhook(headers, rawBody, secret);
  }
}
