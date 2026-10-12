'use client';
// /orders/[id]/print — A5 order slip preview of Figma "DLV-06 / ORD-09 — Labels viewer (…) + order print preview A5".
import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { OrderPrintPage } from '@/features/orders/print/print-page';

export default function OrderPrintRoute() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense fallback={null}>
      <OrderPrintPage key={id} id={id} />
    </Suspense>
  );
}
