'use client';
// /cash — Figma "GDS-09 — Cash register — ledger with locked automatic rows".
import { Suspense } from 'react';
import { CashPage } from '@/features/gds/cash';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CashPage />
    </Suspense>
  );
}
