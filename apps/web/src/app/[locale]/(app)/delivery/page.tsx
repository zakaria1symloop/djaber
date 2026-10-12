'use client';
// /delivery — the overview (DLV-08: shipments, failures, stale parcels) arrives with courier sending (M6). Until then
// the sidebar entry "Livraison & suivi" opens the fee grid, the only delivery screen of M5 (assumptions-log, M5 web).
import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';

export default function DeliveryPage() {
  const router = useRouter();
  useEffect(() => router.replace('/delivery/fees'), [router]);
  return null;
}
