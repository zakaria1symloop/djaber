'use client';
// /help — Figma "HELP — Help & support (merchant) — center, status, contact form, my tickets".
import { Suspense } from 'react';
import { HelpCenterPage } from '@/features/help/help-center';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <HelpCenterPage />
    </Suspense>
  );
}
