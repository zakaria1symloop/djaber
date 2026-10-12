'use client';
// /sales/new — the list with the "Nouvelle vente" side sheet open (GDS-08; drafts ?draft=<id>).
import { Suspense } from 'react';
import { SalesPage } from '@/features/gds/sales';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SalesPage creating />
    </Suspense>
  );
}
