import { Suspense, type ReactNode } from 'react';
import { AdminShell } from '@/components/shell/admin-shell';

// (admin) — AdminShell (02-next-route-map §2.3): requires a session and User.platformRole.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
