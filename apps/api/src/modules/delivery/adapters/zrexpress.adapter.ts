// 05-integrations §2.2 — ZR Express (Procolis API v1) live driver [V1 delivery.service.ts]. No cancel, no label
// (Djaber fallback label), batch tracking ≤ 50, rates from `tarification`.
import { WILAYA_COUNT } from '@djaber/shared';
import { courierDate, checkStatus, fieldOfMessage, num, str, type CourierTransport } from './http';
import { CourierError, PROVIDER_CAPABILITIES, type AnyCredentials, type CourierAdapter, type CreateShipmentInput, type TestResult, type TrackResult } from './courier-adapter';
import { mapCourierStatus } from './status-maps';

export const ZR_BASE = 'https://procolis.com/api_v1';

export class ZrExpressAdapter implements CourierAdapter {
  readonly provider = 'zrexpress' as const;
  readonly driver = 'live' as const;
  readonly capabilities = PROVIDER_CAPABILITIES.zrexpress;
  constructor(private readonly http: CourierTransport) {}

  private headers(c: AnyCredentials) {
    return { token: str(c.token), key: str(c.key), Accept: 'application/json' };
  }

  async testCredentials(c: AnyCredentials): Promise<TestResult> {
    const t0 = Date.now();
    try {
      const res = checkStatus(await this.http({ method: 'GET', url: `${ZR_BASE}/token`, headers: this.headers(c) }));
      const statut = str((res.json as Record<string, unknown> | null)?.Statut);
      if (res.status === 200 && statut === 'Accès activé') return { ok: true, latencyMs: Date.now() - t0 };
      return { ok: false, code: 'COURIER_CREDENTIALS_INVALID', message: statut || `HTTP ${res.status}`, latencyMs: Date.now() - t0 };
    } catch (e) {
      if (e instanceof CourierError) return { ok: false, code: e.kind === 'auth' ? 'COURIER_CREDENTIALS_INVALID' : 'COURIER_UNAVAILABLE', message: e.message, latencyMs: Date.now() - t0 };
      throw e;
    }
  }

  async createShipment(c: AnyCredentials, input: CreateShipmentInput) {
    const body = {
      Colis: [
        {
          Tracking: '',
          TypeLivraison: input.isStopdesk ? 1 : 0,
          TypeColis: 0,
          Confrimee: 1,
          Client: input.recipient.name,
          MobileA: input.recipient.phone,
          MobileB: input.recipient.phone2 ?? '',
          Adresse: input.address,
          IDWilaya: String(input.wilayaId),
          Commune: input.communeCode || input.communeName,
          Total: String(input.codAmount),
          Note: input.note ?? '',
          TProduit: input.productSummary,
          id_Externe: input.orderNumber,
          Source: '',
        },
      ],
    };
    const res = checkStatus(await this.http({ method: 'POST', url: `${ZR_BASE}/add_colis`, headers: this.headers(c), body }));
    const row = ((res.json as { Colis?: Record<string, unknown>[] } | null)?.Colis ?? [])[0];
    if (!row) throw new CourierError('unavailable', 'empty answer');
    const message = str(row.MessageRetour);
    if (message !== 'Good') throw new CourierError('validation', message || 'refused', fieldOfMessage(message));
    const trackingNumber = str(row.Tracking);
    if (!trackingNumber) throw new CourierError('unavailable', 'no tracking returned');
    return { trackingNumber, externalId: trackingNumber, labelUrl: null, rawStatus: 'En préparation', raw: row };
  }

  private toTrack(row: Record<string, unknown>): TrackResult {
    const rawStatus = str(row.Situation);
    const m = mapCourierStatus('zrexpress', rawStatus);
    return { trackingNumber: str(row.Tracking), rawStatus, mapped: m?.mapped ?? null, failureReason: m?.failureReason ?? null, at: courierDate(row.DateH_Situation), location: str(row.Wilaya ?? row.Commune) || null, raw: row };
  }

  async track(c: AnyCredentials, trackingNumber: string): Promise<TrackResult> {
    const [r] = await this.trackMany(c, [trackingNumber]);
    if (!r || !r.rawStatus) throw new CourierError('not_found', 'unknown tracking');
    return r;
  }

  async trackMany(c: AnyCredentials, trackingNumbers: string[]): Promise<TrackResult[]> {
    const res = checkStatus(await this.http({ method: 'POST', url: `${ZR_BASE}/lire`, headers: this.headers(c), body: { Colis: trackingNumbers.map((Tracking) => ({ Tracking })) } }));
    const rows = (res.json as { Colis?: Record<string, unknown>[] } | null)?.Colis ?? [];
    return rows.filter((r) => str(r.Tracking) && str(r.Situation)).map((r) => this.toTrack(r));
  }

  async getAllRates(c: AnyCredentials, _fromWilayaId: number) {
    const res = checkStatus(await this.http({ method: 'POST', url: `${ZR_BASE}/tarification`, headers: this.headers(c), body: {} }));
    const j = res.json as unknown;
    const rows = (Array.isArray(j) ? j : ((j as { Tarification?: unknown[]; data?: unknown[] } | null)?.Tarification ?? (j as { data?: unknown[] } | null)?.data ?? [])) as Record<string, unknown>[];
    return rows
      .map((r) => ({ wilayaId: num(r.IDWilaya) ?? 0, home: num(r.Domicile ?? r.TarifLivraison), stopdesk: num(r.Stopdesk ?? r.TarifStopdesk) }))
      .filter((r) => r.wilayaId >= 1 && r.wilayaId <= WILAYA_COUNT);
  }

  async getRates(c: AnyCredentials, fromWilayaId: number, toWilayaId: number) {
    const row = (await this.getAllRates(c, fromWilayaId)).find((r) => r.wilayaId === toWilayaId);
    return row ? { home: row.home, stopdesk: row.stopdesk } : null;
  }
}
