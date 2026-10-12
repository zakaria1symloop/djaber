'use client';
// /sales/[id] — Figma "CAT-11 / GDS-06b — … Purchase & sale detail" (sale).
import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { SalePage } from '@/features/gds/sale-page';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense fallback={null}>
      <SalePage key={id} id={id} />
    </Suspense>
  );
}
