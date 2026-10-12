'use client';
// /orders/[id] — Figma "ORD-06 — Order page — new", "ORD-07 — Confirm order dialog — outcome step", order dialogs of
// "DLG — Orders & delivery" and "DLG — Orders, delivery & clients II".
import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { OrderPage } from '@/features/orders/page/order-page';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense fallback={null}>
      <OrderPage key={id} id={id} />
    </Suspense>
  );
}
