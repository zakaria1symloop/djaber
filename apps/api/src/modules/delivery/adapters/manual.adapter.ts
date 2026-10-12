// 05-integrations §2.5 — "Livraison propre" (self-delivery, D14): no credentials, no tracking, status changes only by
// the merchant (order page actions). `createShipment` only names the parcel.
import { CourierError, PROVIDER_CAPABILITIES, type CourierAdapter, type CreateShipmentInput, type TestResult } from './courier-adapter';

export class ManualAdapter implements CourierAdapter {
  readonly provider = 'manual' as const;
  readonly driver = 'live' as const;
  readonly capabilities = PROVIDER_CAPABILITIES.manual;

  async testCredentials(): Promise<TestResult> {
    return { ok: true, latencyMs: 0 };
  }
  async createShipment(_c: unknown, input: CreateShipmentInput) {
    return { trackingNumber: input.trackingNumber || `MAN-${input.orderNumber}`, externalId: null, labelUrl: null, rawStatus: null, raw: null };
  }
  async track(): Promise<never> {
    throw new CourierError('not_found', 'manual parcels are not tracked');
  }
}
