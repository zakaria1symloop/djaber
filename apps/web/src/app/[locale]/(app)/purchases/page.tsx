'use client';
// /purchases — Figma "GDS-07 — Purchases — list + receive dialog".
import { Suspense } from 'react';
import { PurchasesPage } from '@/features/gds/purchases';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PurchasesPage />
    </Suspense>
  );
}
