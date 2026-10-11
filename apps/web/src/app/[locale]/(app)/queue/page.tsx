// /queue — Figma "QUEUE — File d'attente — items" + "DLG — Inbox & queue" (queue empty).
import { Suspense } from 'react';
import { QueueView } from '@/features/queue/queue-view';

export default function QueuePage() {
  return (
    <Suspense fallback={null}>
      <QueueView />
    </Suspense>
  );
}
