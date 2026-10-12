// Keys of the delivery `actions: ActionDescriptor[]` the web understands (api-contract §1.12), one place so the screens
// follow the server presenters by editing this map only: `ShipmentView.actions` / `DeliveryRowView.actions`
// (packages/shared/src/schemas/delivery.ts) and `CourierAccountView.actions`.
export const SHIPMENT_ACTION = {
  /** row of an order without parcel (DLV-05 dialog) */
  send: 'send_courier',
  shipManual: 'ship_manual',
  sync: 'sync',
  label: 'label',
  /** re-sends a parcel whose creation failed ("Corriger et renvoyer") */
  retry: 'retry',
  retryDelivery: 'retry_delivery',
  changeCourier: 'change_courier',
  cancel: 'cancel',
  markFailed: 'mark_failed',
  markDelivered: 'mark_delivered',
  markReturned: 'mark_returned',
  openOrder: 'open_order',
  callClient: 'call_client',
  editAddress: 'edit_address',
} as const;

export const COURIER_ACTION = {
  edit: 'edit',
  test: 'test',
  setDefault: 'set_default',
  activate: 'activate',
  deactivate: 'deactivate',
  delete: 'delete',
} as const;

/** WebSocket events of the delivery module (03-events §2). */
export const DELIVERY_EVENTS = { shipmentUpdated: 'shipment.updated' } as const;
