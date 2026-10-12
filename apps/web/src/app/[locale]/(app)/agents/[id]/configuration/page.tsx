// /agents/[id]/configuration — Figma "AGT-04 — Agent page — Configuration tab (edit as tabs, dirty, saving, conflict)".
import { Suspense } from 'react';
import { AgentConfiguration } from '@/features/agents/agent-page/configuration';

export default function AgentConfigurationPage() {
  return (
    <Suspense fallback={null}>
      <AgentConfiguration />
    </Suspense>
  );
}
