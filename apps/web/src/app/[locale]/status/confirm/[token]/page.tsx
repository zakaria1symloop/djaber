'use client';
// /status/confirm/[token] — double opt-in link of the incident subscription (`GET /status/confirm/:token`).
import { use } from 'react';
import { StatusTokenPage } from '@/features/status/status-page';

export default function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  return <StatusTokenPage kind="confirm" token={decodeURIComponent(token)} />;
}
