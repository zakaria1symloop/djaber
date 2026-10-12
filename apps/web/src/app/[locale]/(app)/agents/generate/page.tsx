// /agents/generate — Figma "DLG — Agents & channels" (Générer un agent depuis ma page).
import { Suspense } from 'react';
import { GenerateAgent } from '@/features/agents/generate';

export default function GenerateAgentPage() {
  return (
    <Suspense fallback={null}>
      <GenerateAgent />
    </Suspense>
  );
}
