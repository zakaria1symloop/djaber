'use client';
// /status/unsubscribe/[token] — link of the incident e-mails (`GET /status/unsubscribe/:token`).
import { use } from 'react';
import { StatusTokenPage } from '@/features/status/status-page';

export default function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  return <StatusTokenPage kind="unsubscribe" token={decodeURIComponent(token)} />;
}
