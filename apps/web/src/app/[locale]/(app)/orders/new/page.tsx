'use client';
// /orders/new — Figma "ORD-02 — New order — form (client conflict, variant, fee quote)" + "ORD-02 — … AR (RTL)".
// `?clientId=` (inbox client panel, client sheet), `?conversationId=` (inbox), `?duplicate=<orderId>` (order menu).
// Permission `orders.write`; the fee override needs `orders.money`.
import { NewOrderForm } from '@/features/orders/form/order-form';

export default function NewOrderPage() {
  return <NewOrderForm />;
}
