// /agents/[id]/playground — Figma "AGT-07 — Agent playground — dry run with tool calls".
import { Suspense } from 'react';
import { AgentPlaygroundTab } from '@/features/agents/agent-page/playground-tab';

export default function AgentPlaygroundPage() {
  return (
    <Suspense fallback={null}>
      <AgentPlaygroundTab />
    </Suspense>
  );
}
