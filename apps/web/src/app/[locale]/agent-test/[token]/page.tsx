// /agent-test/[token] — public shared playground (24 h link, no layout group, no session): Figma "AGT-07" shared
// variant + "DLG — Agents & channels" (Lien de test).
import { Suspense } from 'react';
import { SharedTest } from '@/features/agents/playground/shared-test';

export default async function AgentTestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-4 py-8">
      <Suspense>
        <SharedTest token={decodeURIComponent(token)} />
      </Suspense>
    </main>
  );
}
