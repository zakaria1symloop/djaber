// /settings/credits — Figma "BIL-04 / BIL-03 — Credits page (ledger) · Invoices · Checkout return" (read-only part of M4).
import { Suspense } from 'react';
import { CreditsPage } from '@/features/credits/credits-page';

export default function SettingsCreditsPage() {
  return (
    <Suspense fallback={null}>
      <CreditsPage />
    </Suspense>
  );
}
