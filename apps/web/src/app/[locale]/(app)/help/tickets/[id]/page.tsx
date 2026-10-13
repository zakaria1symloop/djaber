'use client';
// /help/tickets/[id] — ticket thread (HELP-04).
import { use } from 'react';
import { TicketPage } from '@/features/help/ticket-page';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TicketPage id={decodeURIComponent(id)} />;
}
