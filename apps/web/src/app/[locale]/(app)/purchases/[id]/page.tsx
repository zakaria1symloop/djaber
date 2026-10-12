'use client';
// /purchases/[id] — Figma "CAT-11 / GDS-06b — … Purchase & sale detail" (purchase).
import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { PurchasePage } from '@/features/gds/purchase-page';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense fallback={null}>
      <PurchasePage key={id} id={id} />
    </Suspense>
  );
}
