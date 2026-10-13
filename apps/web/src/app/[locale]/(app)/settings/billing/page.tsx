// /settings/billing — Figma "BIL-01 — Settings — Plan & billing" (M9).
import { Suspense } from 'react';
import { BillingPage } from '@/features/billing/billing-page';

export default function SettingsBillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingPage />
    </Suspense>
  );
}
