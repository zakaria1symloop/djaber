'use client';
// /help/tickets — "Mes demandes" (HELP frame card, full list).
import { Suspense } from 'react';
import { TicketsPage } from '@/features/help/tickets-page';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TicketsPage />
    </Suspense>
  );
}
