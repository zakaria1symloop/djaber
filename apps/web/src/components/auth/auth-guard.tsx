'use client';
// (auth) guard: visitors only. A logged-in user is sent to `returnTo` (or Home); /workspaces/new needs a session.
import { Spinner } from '@djaber/ui';
import { useSearchParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { decideAuth } from '@/lib/guards';
import { useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';

export function AuthGuard({ children }: { children: ReactNode }) {
  const t = useT();
  const { status, me } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const returnTo = useSearchParams().get('returnTo');
  const decision = decideAuth({ status, pathname, returnTo, ownedWorkspaceId: me?.ownedWorkspaceId ?? null });
  const to = decision.kind === 'redirect' ? decision.to : null;
  useEffect(() => {
    if (to) router.replace(to);
  }, [to, router]);
  if (decision.kind !== 'render') return <Spinner label={t('common.loading')} />;
  return <>{children}</>;
}
