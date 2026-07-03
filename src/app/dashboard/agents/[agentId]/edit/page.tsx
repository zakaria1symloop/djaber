'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import AgentForm from '../../_components/AgentForm';

export default function EditAgentPage() {
  const params = useParams();
  return (
    <Suspense fallback={<div className="w-full text-zinc-400 text-sm">Loading…</div>}>
      <AgentForm agentId={params.agentId as string} />
    </Suspense>
  );
}
