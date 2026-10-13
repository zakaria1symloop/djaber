// /settings/billing/return?ref= — Figma "BIL-04 / BIL-03 — … Checkout return" (M9, FL-28).
import { Suspense } from 'react';
import { CheckoutReturnPage } from '@/features/billing/checkout-return-page';

export default function SettingsBillingReturnPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutReturnPage />
    </Suspense>
  );
}
