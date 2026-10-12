'use client';
// /orders — Figma "ORD-05 v2 — Orders — list (dense rows, source column, actions dropdown)" + filter panel, row menu,
// bulk results dialog, AR frame and "GLOBAL — Offline — stale data (Orders)".
import { Suspense } from 'react';
import { OrdersList } from '@/features/orders/list/orders-list';

export default function OrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersList />
    </Suspense>
  );
}
