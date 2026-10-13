'use client';
// /admin/reports — Figma "ADM-11 — Platform admin — abuse reports & blocked words"
// (treated report = ?sheet=<id>; header sheets ?panel=words | rules).
import { Suspense } from 'react';
import { ReportsPage } from '@/features/admin-safety/reports-page';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ReportsPage />
    </Suspense>
  );
}
