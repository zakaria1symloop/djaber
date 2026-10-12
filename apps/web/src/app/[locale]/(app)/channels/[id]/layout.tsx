// ChannelTabs (02-next-route-map §1): Vue d'ensemble · Messages · IA · Historique · Analyse.
import { Suspense, type ReactNode } from 'react';
import { ChannelShell } from '@/features/channels/channel-page/channel-shell';

export default async function ChannelLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <ChannelShell key={id} id={id}>
        {children}
      </ChannelShell>
    </Suspense>
  );
}
