'use client';
// /admin/support — Figma "ADM-12 — Platform admin — support tickets" (detail = ?sheet=<id>).
import { Suspense } from 'react';
import { SupportPage } from '@/features/admin-ops/support-page';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SupportPage />
    </Suspense>
  );
}
