// Wire types of the delivery endpoints used by the web (geo, fee grid, quote, stop-desks: M5; couriers, shipments,
// overview, labels, rates, public tracking: M6) = the shared read models of `packages/shared/src/schemas/delivery.ts`
// (api-contract §3.8, §3.14, §4 ShipmentsQuery). Web names are short aliases of the shared `…View` names.
import type {
  BulkSendResult as SharedBulkSendResult,
  BulkSendRowResult,
  CommuneView,
  CopyFeesDiffView,
  CopyFeesFromCourierInput,
  CourierAccountView,
  CourierCapabilities,
  CourierCredentialField,
  CourierProviderName,
  CourierProviderView,
  CourierRatesView,
  CourierRateView,
  CourierTestResultView,
  CreateCourierAccountInput,
  CreateShipmentInput,
  DeliveryOverviewView,
  DeliveryRowView,
  DeliveryTab,
  FailureReasonCode,
  FeeGridMeta,
  FeeQuoteView,
  FeeRuleView,
  LabelFileView,
  LabelFormat,
  LabelsJobInput,
  LabelsJobResult,
  MarkDeliveredInput,
  MarkReturnedInput,
  ProductLabelsInput,
  ProductLabelsJobResult,
  PublicTrackingReportInput,
  ShipmentEventView,
  ShipmentStatusName,
  ShipmentUpdatedEvent,
  ShipmentView,
  StopdeskView,
  TrackingPublicView,
  UpdateCourierAccountInput,
  UpdateFeeRuleInput,
  WilayaView,
} from '@djaber/shared';
import type { Meta } from '@/lib/api';

export type Wilaya = WilayaView;
export type Commune = CommuneView;
export type Stopdesk = StopdeskView;
export type FeeRule = FeeRuleView;
export type FeeRuleInput = UpdateFeeRuleInput;
export type FeeQuote = FeeQuoteView;
export type { FeeGridMeta };
export { WILAYA_COUNT } from '@djaber/shared';

export type Shipment = ShipmentView;
export type ShipmentEvent = ShipmentEventView;
export type ShipmentStatus = ShipmentStatusName;
export type FailureReason = FailureReasonCode;
export type CourierProvider = CourierProviderName;
export type CourierAccount = CourierAccountView;
export type CourierProviderInfo = CourierProviderView;
export type CourierTestResult = CourierTestResultView;
export type CourierInput = CreateCourierAccountInput;
export type CourierPatch = UpdateCourierAccountInput;
export type DeliveryOverview = DeliveryOverviewView;
export type DeliveryRow = DeliveryRowView;
export type CourierRates = CourierRatesView;
export type CourierRate = CourierRateView;
export type CopyRatesInput = CopyFeesFromCourierInput;
export type CopyRatesDiff = CopyFeesDiffView;
export type SendInput = CreateShipmentInput;
export type BulkSendResult = SharedBulkSendResult;
export type BulkSendRow = BulkSendRowResult;
export type LabelFile = LabelFileView;
export type LabelsInput = LabelsJobInput;
export type LabelsResult = LabelsJobResult;
export type ProductLabelsResult = ProductLabelsJobResult;
export type TrackingPublic = TrackingPublicView;
export type TrackingReportInput = PublicTrackingReportInput;
export type ShipmentsPage = { rows: DeliveryRow[]; total: number; meta: Meta };
export type { CourierCapabilities, CourierCredentialField, DeliveryTab, LabelFormat, MarkDeliveredInput, MarkReturnedInput, ProductLabelsInput, ShipmentUpdatedEvent };

/* ---------- local copies of the shared constants (same values) ---------- */
export const SHIPMENT_STATUSES = ['pending', 'sent', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned', 'cancelled', 'stale'] as const satisfies readonly ShipmentStatus[];
export const FAILURE_REASONS = ['unreachable', 'address', 'refused', 'damaged', 'other'] as const satisfies readonly FailureReason[];
export const COURIER_PROVIDERS = ['zrexpress', 'ecotrack', 'yalidine'] as const satisfies readonly CourierProvider[];
export const LABEL_FORMAT_LIST = ['a6', 'thermal', 'a5'] as const satisfies readonly LabelFormat[];
export const REPORT_REASONS = ['fraud', 'harassment', 'spam', 'inappropriate_content', 'other'] as const satisfies readonly TrackingReportInput['reason'][];
