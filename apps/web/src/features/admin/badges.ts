'use client';
// Sidebar badges of the admin shell: pending moderation items, open abuse reports, open support tickets.
// Live values come from the WS admin room (`moderation.queue { pending, urgent }`, `reports.queue`, `tickets.queue`,
// api-contract §5); the last value is kept for the session.
import { useState } from 'react';
import { useWsEvent } from '@/lib/ws';
import type { AdminBadge } from '@/components/shell/admin-nav';

type QueuePayload = { pending?: number; open?: number; count?: number };
const pick = (p: QueuePayload) => p.pending ?? p.open ?? p.count ?? 0;

export function useAdminBadges(): Partial<Record<AdminBadge, number>> {
  const [counts, setCounts] = useState<Partial<Record<AdminBadge, number>>>({});
  useWsEvent<QueuePayload>('moderation.queue', (p) => setCounts((c) => ({ ...c, moderation: pick(p) })));
  useWsEvent<QueuePayload>('reports.queue', (p) => setCounts((c) => ({ ...c, reports: pick(p) })));
  useWsEvent<QueuePayload>('tickets.queue', (p) => setCounts((c) => ({ ...c, support: pick(p) })));
  return counts;
}
