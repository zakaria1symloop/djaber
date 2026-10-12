'use client';
// /delivery/couriers — Figma "DLV-01/03 — Delivery — fee grid + couriers settings" (couriers half); DLG II (Ajouter un
// transporteur, test states, Supprimer bloqué).
import { Suspense } from 'react';
import { CouriersPage } from '@/features/delivery/couriers';

export default function DeliveryCouriersPage() {
  return (
    <Suspense fallback={null}>
      <CouriersPage />
    </Suspense>
  );
}
