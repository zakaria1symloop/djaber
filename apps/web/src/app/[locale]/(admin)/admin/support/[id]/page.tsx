'use client';
// /admin/support/[id] — one ticket of "ADM-12 — Platform admin — support tickets" on its own page (direct link).
import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { SupportTicketPage } from '@/features/admin-ops/support-page';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense fallback={null}>
      <SupportTicketPage id={id} />
    </Suspense>
  );
}
