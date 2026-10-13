// The keys of the order `actions: ActionDescriptor[]` (api-contract §1.12) the web understands — one place, so the
// screen follows the server presenter (`apps/api/src/modules/orders/order.presenter.ts` `orderActions`) by editing this map
// only. `log_call` and `duplicate` are not served: "Journaliser un appel" uses the `call` descriptor, "Dupliquer" is a
// local link (prefill of /orders/new). `payment_link` and `refund` open the online-payment dialogs (P2, M9).
export const ORDER_ACTION = {
  /** opens the confirm dialog (call + outcome) */
  call: 'call',
  /** direct `new → confirmed` without a call */
  confirm: 'confirm',
  callback: 'callback',
  logCall: 'log_call',
  openConversation: 'open_conversation',
  edit: 'edit',
  assign: 'assign',
  prepare: 'prepare',
  sendToCourier: 'send_courier',
  shipManual: 'ship_manual',
  deliver: 'deliver',
  changeStatus: 'change_status',
  return: 'return',
  address: 'edit_address',
  recordPayment: 'record_payment',
  paymentLink: 'payment_link',
  refund: 'refund',
  print: 'print',
  duplicate: 'duplicate',
  cancel: 'cancel',
  delete: 'delete',
} as const;
export type OrderActionKey = (typeof ORDER_ACTION)[keyof typeof ORDER_ACTION];

/** Bulk endpoints of the selection bar (`POST /orders/bulk/…`). */
export const ORDER_BULK = { status: 'status', assign: 'assign', print: 'print' } as const;

/** WebSocket events of the orders module (03-events §2). */
export const ORDER_EVENTS = { created: 'order.created', updated: 'order.updated', deleted: 'order.deleted' } as const;
