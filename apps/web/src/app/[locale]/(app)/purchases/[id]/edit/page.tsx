'use client';
// /purchases/[id]/edit — the new purchase form on a draft / pending purchase (items locked once received).
import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { PurchaseFormPage } from '@/features/gds/purchase-form';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense fallback={null}>
      <PurchaseFormPage key={id} purchaseId={id} />
    </Suspense>
  );
}
