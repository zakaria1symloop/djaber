// AnalyticsTabs (02-next-route-map §1 `analytics/layout.tsx`): overview + 8 tabs + PeriodPicker.
import { Suspense, type ReactNode } from 'react';
import { AnalyticsShell } from '@/features/analytics/shell';

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AnalyticsShell>{children}</AnalyticsShell>
    </Suspense>
  );
}
