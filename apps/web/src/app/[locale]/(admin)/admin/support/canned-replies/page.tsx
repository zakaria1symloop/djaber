'use client';
// /admin/support/canned-replies — "Réponses types" of ADM-12 (HELP-05: CannedReply shortcuts, editable here).
import { Suspense } from 'react';
import { CannedRepliesPage } from '@/features/admin-ops/support-page';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CannedRepliesPage />
    </Suspense>
  );
}
