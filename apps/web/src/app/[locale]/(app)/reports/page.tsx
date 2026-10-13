'use client';
// /reports — Figma "ANA-03 — Reports — hub (23 reports) + export jobs".
import { Suspense } from 'react';
import { ReportsHubPage } from '@/features/reports/hub';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ReportsHubPage />
    </Suspense>
  );
}
