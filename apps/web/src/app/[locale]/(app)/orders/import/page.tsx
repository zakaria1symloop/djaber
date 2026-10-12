'use client';
// /orders/import — CAT-06 import wizard applied to orders (ORD-05 v2 "Importer"; M5 carry-over, P2 D69).
import { Suspense } from 'react';
import { OrderImportWizard } from '@/features/orders/import/order-import';

export default function OrderImportPage() {
  return (
    <Suspense fallback={null}>
      <OrderImportWizard />
    </Suspense>
  );
}
