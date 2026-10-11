'use client';
import { ErrorState, SystemPage } from '@djaber/ui';
import { useT } from '@/lib/i18n';

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  return (
    <SystemPage>
      <ErrorState
        title={t('state.list.error.title')}
        description={t('state.list.error.description', { ref: error.digest ?? '—' })}
        action={{ label: t('action.retry'), onClick: reset }}
      />
    </SystemPage>
  );
}
