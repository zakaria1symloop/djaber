import { Suspense, type ReactNode } from 'react';
import { MerchantShell } from '@/components/shell/merchant-shell';

// (app) — MerchantShell (02-next-route-map §2.1): requires a session and a workspace.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <MerchantShell>{children}</MerchantShell>
    </Suspense>
  );
}
