'use client';
// /inventory — DLG GDS "Lancer un inventaire" + list of counts.
import { Suspense } from 'react';
import { InventoriesPage } from '@/features/gds/inventory';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <InventoriesPage />
    </Suspense>
  );
}
