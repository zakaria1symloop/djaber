'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import AgentForm from '../../_components/AgentForm';
import { useTranslation } from '@/contexts/LanguageContext';

export default function EditAgentPage() {
  const params = useParams();
  const { t } = useTranslation();
  return (
    <Suspense fallback={<div className="w-full text-zinc-400 text-sm">{t('shell.common.loading')}</div>}>
      <AgentForm agentId={params.agentId as string} />
    </Suspense>
  );
}
