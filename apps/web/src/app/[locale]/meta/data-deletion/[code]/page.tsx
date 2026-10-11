// /meta/data-deletion/[code] — Figma "PUB — Legal (CMS) · Landing & help · Meta data-deletion status" (right column).
// Public status page of a Meta data-deletion request (MSG-08): no navigation, no session required.
import { Suspense } from 'react';
import { DataDeletionStatus } from '@/features/notifications/data-deletion-status';

export default async function DataDeletionPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Suspense>
        <DataDeletionStatus code={decodeURIComponent(code)} />
      </Suspense>
    </main>
  );
}
