import { Suspense, type ReactNode } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';

// AuthLayout (02-next-route-map §1): centred 440 px card on ink/base — frame "AUTH — States catalogue".
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Suspense>
        <AuthGuard>{children}</AuthGuard>
      </Suspense>
    </main>
  );
}
