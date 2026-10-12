// /agents/[id] — Figma "AGT-03 — Agent page — overview (tabs, versions, rollback)".
import { Suspense } from 'react';
import { AgentOverview } from '@/features/agents/agent-page/overview';

export default function AgentOverviewPage() {
  return (
    <Suspense fallback={null}>
      <AgentOverview />
    </Suspense>
  );
}
