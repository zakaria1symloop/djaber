// /agents/new/[step] — Figma "AGT-02 — Agent wizard — step 1…5" (`identity`, `knowledge`, `behaviour`, `channels`,
// `activate`); the draft id travels in `?draft=`.
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { isStepSlug } from '@/features/agents/logic';
import { AgentWizard } from '@/features/agents/wizard/wizard';

export default async function AgentWizardStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  if (!isStepSlug(step)) notFound();
  return (
    <Suspense fallback={null}>
      <AgentWizard key={step} step={step} />
    </Suspense>
  );
}
