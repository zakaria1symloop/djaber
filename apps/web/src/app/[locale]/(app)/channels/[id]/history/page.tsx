// /channels/[id]/history — Figma "CHN-07b — …" + "DLG — Agents & channels" (Synchroniser l'historique).
import { Suspense } from 'react';
import { ChannelHistory } from '@/features/channels/channel-page/history';

export default function ChannelHistoryPage() {
  return (
    <Suspense fallback={null}>
      <ChannelHistory />
    </Suspense>
  );
}
