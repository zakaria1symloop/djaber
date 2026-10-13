'use client';
// /admin/health — Figma "ADM-14 — Platform admin — jobs & health (queues, Meta webhooks, AI runs, incidents)".
import { Suspense } from 'react';
import { HealthPage } from '@/features/admin-ops/health-page';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <HealthPage />
    </Suspense>
  );
}
