'use client';
// /purchases/new — Figma "CAT-11 / GDS-06b — … New purchase form" (?supplierId, ?productId&variantId&quantity&unitCost, ?reco).
import { Suspense } from 'react';
import { PurchaseFormPage } from '@/features/gds/purchase-form';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PurchaseFormPage />
    </Suspense>
  );
}
