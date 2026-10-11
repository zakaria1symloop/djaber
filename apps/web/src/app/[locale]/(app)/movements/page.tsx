// /movements — Figma "GDS-05 — Movements — list + filter panel".
import { Suspense } from 'react';
import { MovementsList } from '@/features/catalog/stock/movements';

export default function MovementsPage() {
  return (
    <Suspense fallback={null}>
      <MovementsList />
    </Suspense>
  );
}
