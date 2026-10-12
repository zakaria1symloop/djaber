// /agents — Figma "AGT-01 — Agents — list (active, paused, insights)".
import { Suspense } from 'react';
import { AgentsList } from '@/features/agents/agents-list';

export default function AgentsPage() {
  return (
    <Suspense fallback={null}>
      <AgentsList />
    </Suspense>
  );
}
