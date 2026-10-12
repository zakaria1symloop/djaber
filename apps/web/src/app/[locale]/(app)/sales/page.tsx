'use client';
// /sales — Figma "GDS-08 — Sales (counter) — list + new sale with partial payment".
import { Suspense } from 'react';
import { SalesPage } from '@/features/gds/sales';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SalesPage />
    </Suspense>
  );
}
