'use client';
// /inventory/[id] — counting + DLG GDS "Valider l'inventaire".
import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { InventoryPage } from '@/features/gds/inventory';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense fallback={null}>
      <InventoryPage key={id} id={id} />
    </Suspense>
  );
}
