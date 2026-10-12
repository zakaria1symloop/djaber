// AgentTabs (02-next-route-map §1): Vue d'ensemble · Configuration · Insights · Bac à essai.
import { Suspense, type ReactNode } from 'react';
import { AgentShell } from '@/features/agents/agent-page/agent-shell';

export default async function AgentLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <AgentShell key={id} id={id}>
        {children}
      </AgentShell>
    </Suspense>
  );
}
