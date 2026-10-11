// /channels — Figma "CHN-06 — Channels — list with statuses".
import { Suspense } from 'react';
import { ChannelsList } from '@/features/channels/channels-list';

export default function ChannelsPage() {
  return (
    <Suspense fallback={null}>
      <ChannelsList />
    </Suspense>
  );
}
