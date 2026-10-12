// /agents/[id]/insights — Figma "AGT-08 — Agent page — Insights queue tab".
import { Suspense } from 'react';
import { AgentInsights } from '@/features/agents/agent-page/insights';

export default function AgentInsightsPage() {
  return (
    <Suspense fallback={null}>
      <AgentInsights />
    </Suspense>
  );
}
