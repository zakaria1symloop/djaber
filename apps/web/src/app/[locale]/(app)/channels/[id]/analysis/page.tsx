// /channels/[id]/analysis — Figma "CHN-08 — Channel page — analysis review (import)".
import { Suspense } from 'react';
import { ChannelAnalysis } from '@/features/channels/channel-page/analysis';

export default function ChannelAnalysisPage() {
  return (
    <Suspense fallback={null}>
      <ChannelAnalysis />
    </Suspense>
  );
}
