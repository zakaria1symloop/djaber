// Wire types of the M5 orders endpoints = the shared read models of `packages/shared/src/schemas/orders.ts`
// (api-contract §2, §3.7, §4). Web names are short aliases of the shared `…View` names.
import type {
  AddressView,
  BulkOrderAssignInput,
  BulkOrderPrintInput,
  BulkOrderStatusInput,
  CallLogInput,
  CallResultName,
  CancelOrderInput,
  CancelReasonName,
  ConfirmationStatusName,
  CreateOrderInput,
  DeliverOrderInput,
  DeliveryStatusName,
  FailureReasonName,
  OrderAddressInput,
  OrderAgentRef,
  OrderAssignInput,
  OrderCallbackInput,
  OrderCallView,
  OrderCreatedEvent,
  OrderDeletedEvent,
  OrderDraft,
  OrderHistoryView,
  OrderItemView,
  OrderListItemView,
  OrderNoteView,
  OrderSourceName,
  OrdersExportQuery,
  OrderStatsView,
  OrderStatusChangeInput,
  OrderStatusName,
  OrderSummary,
  OrderUpdatedEvent,
  OrderUserRef,
  OrderView,
  PaymentEntryView,
  PaymentMethodName,
  PaymentStatusName,
  RecordPaymentInput,
  ReturnOrderInput,
  ShipManualInput,
  SourceBadge,
  UpdateOrderInput,
} from '@djaber/shared';
import type { ShipmentEventView, ShipmentStatusName, ShipmentView } from '@djaber/shared';
import type { ClientRefView } from '@djaber/shared';
import type { ChannelRefView } from '@djaber/shared';

export type Money = number;
export type UserRef = OrderUserRef;
export type AgentRef = OrderAgentRef;
export type ClientRef = ClientRefView;
export type ChannelRef = ChannelRefView;
export type Address = AddressView;
export type OrderStatus = OrderStatusName;
export type ConfirmationStatus = ConfirmationStatusName;
export type PaymentStatus = PaymentStatusName;
export type PaymentMethod = PaymentMethodName;
export type DeliveryStatus = DeliveryStatusName;
export type OrderSource = OrderSourceName;
export type CallResult = CallResultName;
export type CancelReason = CancelReasonName;
export type FailureReason = FailureReasonName;
export type ShipmentStatus = ShipmentStatusName;
export type OrderListItem = OrderListItemView;
export type Order = OrderView;
export type OrderItem = OrderItemView;
export type PaymentEntry = PaymentEntryView;
export type OrderCall = OrderCallView;
export type OrderHistoryRow = OrderHistoryView;
export type OrderNote = OrderNoteView;
export type Shipment = ShipmentView;
export type ShipmentEvent = ShipmentEventView;
export type OrderStats = OrderStatsView;
export type {
  BulkOrderAssignInput,
  BulkOrderPrintInput,
  BulkOrderStatusInput,
  CallLogInput,
  CancelOrderInput,
  CreateOrderInput,
  DeliverOrderInput,
  OrderAddressInput,
  OrderAssignInput,
  OrderCallbackInput,
  OrderCreatedEvent,
  OrderDeletedEvent,
  OrderDraft,
  OrdersExportQuery,
  OrderStatusChangeInput,
  OrderSummary,
  OrderUpdatedEvent,
  RecordPaymentInput,
  ReturnOrderInput,
  ShipManualInput,
  SourceBadge,
  UpdateOrderInput,
};

/** Bulk answer `{ data: { results }, meta: { ok, failed } }` — one result per order, never all-or-nothing. */
export type BulkItemResult = { id: string; ok: boolean; skipped?: boolean; error?: { code: string; message: string; params?: Record<string, unknown> } };
export type BulkResponse = { results: BulkItemResult[]; ok: number; failed: number };

/* ---------- local copies of the shared constants (same values; replace by the shared exports when published) ---------- */
export const ORDER_SORTS = ['orderedAt', 'total', 'status', 'clientName'] as const;
export const ORDER_STATUSES = ['new', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled', 'returned'] as const satisfies readonly OrderStatus[];
export const ORDER_BULK_STATUS_TARGETS = ['confirmed', 'preparing', 'shipped', 'cancelled'] as const satisfies readonly OrderStatus[];
export const ORDER_READ_ONLY_STATUSES: readonly OrderStatus[] = ['delivered', 'cancelled', 'returned'];
export const ORDER_BACKDATE_MAX_DAYS = 7;
export const ORDER_NO_ANSWER_PROPOSAL_AT = 3;
export const CALL_RESULTS = ['picked_up', 'no_answer', 'busy', 'voicemail', 'callback', 'wrong_number', 'rejected'] as const satisfies readonly CallResult[];
export const CANCEL_REASONS = ['unreachable', 'changed_mind', 'fake', 'unavailable', 'duplicate', 'other'] as const satisfies readonly CancelReason[];
export const FAILURE_REASONS = ['unreachable', 'refused', 'damaged', 'address', 'other'] as const satisfies readonly FailureReason[];
export const PAYMENT_METHODS = ['cash', 'card', 'transfer', 'ccp', 'other'] as const satisfies readonly PaymentMethod[];
export const ORDER_PERIODS = ['today', '7d', '30d', 'month', 'last_month', '90d', 'year', 'custom'] as const;
