// 05-integrations §2.3 — EcoTrack (public v1 API, per-merchant instance `https://<instance>.ecotrack.dz`) live driver.
// Bearer token; labels as PDF; cancel and retry offered; no rates endpoint in the contract.
import { courierDate, checkStatus, str, type CourierTransport } from './http';
import { CourierError, PROVIDER_CAPABILITIES, type AnyCredentials, type CourierAdapter, type CourierField, type CreateShipmentInput, type TestResult, type TrackResult } from './courier-adapter';
import { mapCourierStatus } from './status-maps';

const FIELD: Record<string, CourierField> = { telephone: 'phone', telephone_2: 'phone', commune: 'commune', adresse: 'address', code_wilaya: 'wilaya', montant: 'cod', poids: 'weight', nom_client: 'other' };

export class EcotrackAdapter implements CourierAdapter {
  readonly provider = 'ecotrack' as const;
  readonly driver = 'live' as const;
  readonly capabilities = PROVIDER_CAPABILITIES.ecotrack;
  constructor(private readonly http: CourierTransport) {}

  private base(c: AnyCredentials) {
    const url = str(c.baseUrl).replace(/\/$/, '');
    if (!/^https:\/\//.test(url)) throw new CourierError('auth', 'invalid instance URL');
    return url;
  }
  private headers(c: AnyCredentials) {
    return { Authorization: `Bearer ${str(c.token)}`, Accept: 'application/json' };
  }

  async testCredentials(c: AnyCredentials): Promise<TestResult> {
    const t0 = Date.now();
    try {
      const res = checkStatus(await this.http({ method: 'GET', url: `${this.base(c)}/api/v1/get/wilayas`, headers: this.headers(c) }));
      if (res.status === 200 && Array.isArray(res.json)) return { ok: true, latencyMs: Date.now() - t0, wilayasServed: (res.json as unknown[]).length };
      return { ok: false, code: 'COURIER_CREDENTIALS_INVALID', message: `HTTP ${res.status}`, latencyMs: Date.now() - t0 };
    } catch (e) {
      if (e instanceof CourierError) return { ok: false, code: e.kind === 'auth' ? 'COURIER_CREDENTIALS_INVALID' : 'COURIER_UNAVAILABLE', message: e.message, latencyMs: Date.now() - t0 };
      throw e;
    }
  }

  async createShipment(c: AnyCredentials, input: CreateShipmentInput) {
    const body = {
      reference: input.orderNumber,
      nom_client: input.recipient.name,
      telephone: input.recipient.phone,
      telephone_2: input.recipient.phone2 ?? '',
      adresse: input.address,
      code_wilaya: input.wilayaId,
      commune: input.communeCode || input.communeName,
      montant: input.codAmount,
      remarque: input.note ?? '',
      produit: input.productSummary,
      stop_desk: input.isStopdesk ? 1 : 0,
      stock: 0,
      poids: Math.max(1, Math.ceil((input.weightGrams ?? 500) / 1000)),
    };
    const res = checkStatus(await this.http({ method: 'POST', url: `${this.base(c)}/api/v1/create/order`, headers: this.headers(c), body }));
    const j = (res.json ?? {}) as { success?: boolean; tracking?: string; errors?: Record<string, string[] | string>; message?: string };
    if (res.status === 422 || j.errors) {
      const [key, msgs] = Object.entries(j.errors ?? {})[0] ?? ['', j.message ?? 'refused'];
      const message = Array.isArray(msgs) ? str(msgs[0]) : str(msgs);
      throw new CourierError('validation', message || 'refused', FIELD[key] ?? 'other');
    }
    if (!j.success || !j.tracking) throw new CourierError(res.status >= 400 ? 'validation' : 'unavailable', j.message ?? `HTTP ${res.status}`, res.status >= 400 ? 'other' : null);
    return { trackingNumber: j.tracking, externalId: j.tracking, labelUrl: null, rawStatus: 'Créé', raw: j };
  }

  private toTrack(tracking: string, info: Record<string, unknown> | null | undefined): TrackResult | null {
    const activity = Array.isArray(info?.activity) ? (info!.activity as Record<string, unknown>[]) : [];
    const last = activity[activity.length - 1];
    const rawStatus = str(last?.event ?? last?.status ?? info?.status);
    if (!rawStatus) return null;
    const m = mapCourierStatus('ecotrack', rawStatus);
    return { trackingNumber: tracking, rawStatus, mapped: m?.mapped ?? null, failureReason: m?.failureReason ?? null, at: courierDate(last?.date ?? last?.created_at), location: str(last?.wilaya ?? last?.location) || null, description: str(last?.remarque ?? last?.causes) || null, raw: info };
  }

  async track(c: AnyCredentials, trackingNumber: string): Promise<TrackResult> {
    const res = checkStatus(await this.http({ method: 'GET', url: `${this.base(c)}/api/v1/get/tracking/info?tracking=${encodeURIComponent(trackingNumber)}`, headers: this.headers(c) }), { notFound: true });
    const r = this.toTrack(trackingNumber, res.json as Record<string, unknown>);
    if (!r) throw new CourierError('not_found', 'no activity');
    return r;
  }

  async trackMany(c: AnyCredentials, trackingNumbers: string[]): Promise<TrackResult[]> {
    const res = checkStatus(await this.http({ method: 'POST', url: `${this.base(c)}/api/v1/get/trackings/info`, headers: this.headers(c), body: { trackings: trackingNumbers } }));
    const j = res.json as unknown;
    const data = (j && typeof j === 'object' && 'data' in (j as object) ? (j as { data: unknown }).data : j) as unknown;
    const out: TrackResult[] = [];
    if (Array.isArray(data)) {
      for (const row of data as Record<string, unknown>[]) {
        const r = this.toTrack(str(row.tracking), row);
        if (r && r.trackingNumber) out.push(r);
      }
    } else if (data && typeof data === 'object') {
      for (const [tracking, info] of Object.entries(data as Record<string, Record<string, unknown>>)) {
        const r = this.toTrack(tracking, info);
        if (r) out.push(r);
      }
    }
    return out;
  }

  async getLabel(c: AnyCredentials, trackingNumber: string) {
    const res = checkStatus(await this.http({ method: 'GET', url: `${this.base(c)}/api/v1/get/order/label?tracking=${encodeURIComponent(trackingNumber)}`, headers: { ...this.headers(c), Accept: 'application/pdf' } }), { notFound: true });
    if (res.status !== 200 || res.bytes.subarray(0, 5).toString('latin1') !== '%PDF-') throw new CourierError('label_unavailable', `HTTP ${res.status}`);
    return { pdf: res.bytes };
  }

  async cancel(c: AnyCredentials, trackingNumber: string) {
    const res = checkStatus(await this.http({ method: 'POST', url: `${this.base(c)}/api/v1/delete/order`, headers: this.headers(c), body: { tracking: trackingNumber } }));
    const j = (res.json ?? {}) as { success?: boolean; message?: string };
    if (res.status >= 400 || j.success === false) throw new CourierError('cancel_not_allowed', j.message ?? `HTTP ${res.status}`);
    return { ok: true, rawStatus: 'Supprimé' };
  }

  async retryDelivery(c: AnyCredentials, trackingNumber: string) {
    const res = checkStatus(await this.http({ method: 'POST', url: `${this.base(c)}/api/v1/ask/retry`, headers: this.headers(c), body: { tracking: trackingNumber } }));
    const j = (res.json ?? {}) as { success?: boolean };
    return { ok: res.status < 400 && j.success !== false };
  }

  portalUrl(c: AnyCredentials, trackingNumber: string) {
    const base = str(c.baseUrl).replace(/\/$/, '');
    return base ? `${base}/suivi/${encodeURIComponent(trackingNumber)}` : null;
  }
}

