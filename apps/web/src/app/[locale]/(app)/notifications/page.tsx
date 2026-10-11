// /notifications — Figma "NTF-01 — Notifications — list".
import { Suspense } from 'react';
import { NotificationsView } from '@/features/notifications/notifications-view';

export default function NotificationsPage() {
  return (
    <Suspense fallback={null}>
      <NotificationsView />
    </Suspense>
  );
}
