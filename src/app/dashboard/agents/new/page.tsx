'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AgentForm from '../_components/AgentForm';
import { getAgents } from '@/lib/user-stock-api';

export default function NewAgentPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  // Enforce one-agent-per-user. If they already have one, send them back.
  useEffect(() => {
    (async () => {
      try {
        const res = await getAgents();
        if (res.agents.length > 0) {
          router.replace('/dashboard/agents');
          return;
        }
      } catch {
        // If the check fails, fall through and let the form render anyway —
        // the backend will reject the create if needed.
      } finally {
        setChecking(false);
      }
    })();
  }, [router]);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-zinc-400 text-sm">Loading…</div>
      </div>
    );
  }

  return <AgentForm />;
}
