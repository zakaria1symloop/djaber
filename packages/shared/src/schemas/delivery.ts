// Delivery: fee grid, quote, geo, shipments read model (03 §11 DLV-01/02/09; 04 §1.5, §4, §22; api-contract §3.8;
// 06 "Delivery", §8.5). Couriers, sending and tracking are M6; this file carries what orders already show.
import { z } from 'zod';
import { FailureReasonValues, ShipmentProviderValues, ShipmentStatusValues } from '../enums';
import type { ActionDescriptor } from './common';
import type { AddressView, OrderUserRef } from './orders';
import type { ClientRefView } from './clients';

export type ShipmentStatusName = (typeof ShipmentStatusValues)[number];
export type ShipmentProviderName = (typeof ShipmentProviderValues)[number];
/** Shipment statuses that hold the order (partial unique index: one active parcel per order). */
export const ACTIVE_SHIPMENT_STATUSES: readonly ShipmentStatusName[] = ['pending', 'sent', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'];
/** 04 §22: "Sans mouvement" = no event for > 5 d while the parcel is `sent | picked_up | in_transit`. */
export const SHIPMENT_STALE_AFTER_DAYS = 5;
export const WILAYA_COUNT = 58;

const MAX_MONEY = 1_000_000;
const money = z.number({ invalid_type_error: 'validation.price', required_error: 'validation.required' }).int('validation.price').min(0, 'validation.price').max(MAX_MONEY, 'validation.price');
const flag = z.preprocess((v) => (v === 'true' || v === '1' || v === true ? true : v === 'false' || v === '0' || v === false ? false : v), z.boolean());

// --- geo (DLV-09) -------------------------------------------------------------------------------------------------------
export type WilayaView = { id: number; code: string; nameFr: string; nameAr: string };
export type CommuneView = { id: number; wilayaId: number; nameFr: string; nameAr: string; postalCode: string | null };

// --- fee grid (DLV-01 / DLV-02) ---------------------------------------------------------------------------------------
/** `PUT /delivery/fees/:wilayaId` — the row becomes `source=custom`. `freeAbove` null ⇒ `Workspace.freeDeliveryThreshold`. */
export const UpdateFeeRuleSchema = z
  .object({
    homePrice: money,
    stopdeskPrice: money,
    returnPrice: money.optional(),
    freeAbove: money.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export type UpdateFeeRuleInput = z.infer<typeof UpdateFeeRuleSchema>;
/** `POST /delivery/fees/seed { overwrite }` — `false` = "Compléter les manquantes" (custom rows kept), `true` = "Tout réinitialiser". */
export const SeedFeesSchema = z.object({ overwrite: z.boolean().default(false) }).strict();
export type SeedFeesInput = z.infer<typeof SeedFeesSchema>;
/** `GET /delivery/fees/quote?wilayaId&stopdesk&subtotal`. */
export const FeeQuoteQuerySchema = z
  .object({
    wilayaId: z.coerce.number({ required_error: 'validation.wilaya' }).int('validation.wilaya').min(1, 'validation.wilaya').max(58, 'validation.wilaya'),
    stopdesk: flag.optional(),
    subtotal: z.coerce.number().int('validation.price').min(0, 'validation.price').optional(),
  })
  .strict();
export type FeeQuoteQuery = z.infer<typeof FeeQuoteQuerySchema>;
/** `GET /delivery/stopdesks?provider&communeId`. */
export const StopdesksQuerySchema = z
  .object({ provider: z.enum(['zrexpress', 'ecotrack', 'yalidine']).optional(), communeId: z.coerce.number().int().positive().optional(), wilayaId: z.coerce.number().int().min(1).max(58).optional() })
  .strict();

/** api-contract §3.8 `FeeRuleDto` (+ `freeAbove` of the schema). `courierCost` = cached courier rate (M6), null until then. */
export type FeeRuleView = {
  wilayaId: number;
  code: string;
  nameFr: string;
  nameAr: string;
  homePrice: number;
  stopdeskPrice: number;
  returnPrice: number;
  freeAbove: number | null;
  isActive: boolean;
  source: 'default' | 'custom';
  courierCost: number | null;
  actions: ActionDescriptor[];
};
/** `GET /delivery/fees` → `{ data: FeeRuleView[], meta: FeeGridMeta }` (58 rows, wilaya order). */
export type FeeGridMeta = { freeDeliveryThreshold: number | null; custom: number; inactive: number; missing: number };
/**
 * api-contract §3.8 `FeeQuoteDto`. `reason` ∈ `grid` | `free_threshold` | `override` | `not_served` | `stopdesk_unavailable`;
 * `base` = the grid price before the free-delivery rule; `freeFrom` = the threshold that applied (or would apply).
 */
export type FeeQuoteView = { fee: number; base: number; free: boolean; reason: 'grid' | 'free_threshold' | 'override' | 'not_served' | 'stopdesk_unavailable'; courierCost: number | null; wilayaServed: boolean; stopdeskAvailable: boolean; freeFrom: number | null; wilayaId: number; isStopdesk: boolean };
export type StopdeskView = { id: string; provider: 'zrexpress' | 'ecotrack' | 'yalidine'; externalId: string; name: string; address: string | null; communeId: number };

// --- shipments read model (api-contract §3.8 ShipmentDto) ----------------------------------------------------------------
export type ShipmentEventView = { at: string; rawStatus: string; mappedStatus: ShipmentStatusName | null; description: string | null; location: string | null; source: string; actor: OrderUserRef | null };
export type ShipmentView = {
  id: string;
  orderId: string;
  orderNumber: string;
  client: ClientRefView;
  provider: ShipmentProviderName;
  courierAccount: { id: string; displayName: string } | null;
  status: ShipmentStatusName;
  trackingNumber: string | null;
  labelUrl: string | null;
  publicTrackingUrl: string;
  codAmount: number;
  weightKg: number | null;
  contentSummary: string | null;
  address: AddressView;
  courierCost: number | null;
  failureReason: (typeof FailureReasonValues)[number] | null;
  deliveryAttempts: number;
  lastError: string | null;
  lastSyncedAt: string | null;
  syncAvailableAt: string | null;
  portalUrl: string | null;
  events: ShipmentEventView[];
  createdAt: string;
  actions: ActionDescriptor[];
};
