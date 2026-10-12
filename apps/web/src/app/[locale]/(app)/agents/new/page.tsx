// /agents/new — Figma "AGT-02 — Agent wizard — step 1 identity" (starting point: 4 presets or "De zéro").
import { Suspense } from 'react';
import { AgentWizard } from '@/features/agents/wizard/wizard';

export default function NewAgentPage() {
  return (
    <Suspense fallback={null}>
      <AgentWizard step="identity" />
    </Suspense>
  );
}
