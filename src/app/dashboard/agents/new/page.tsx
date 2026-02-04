'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NewAgentPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/agents');
  }, [router]);

  return (
    <div className="max-w-5xl mx-auto flex items-center justify-center min-h-[50vh]">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white mb-2">Coming Soon</h2>
        <p className="text-zinc-400">New agent creation is not available yet.</p>
      </div>
    </div>
  );
}
