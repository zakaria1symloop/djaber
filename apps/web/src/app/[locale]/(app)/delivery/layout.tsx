// DeliveryTabs (02-next-route-map §1): Vue d'ensemble · Grille des frais · Transporteurs.
import { Suspense, type ReactNode } from 'react';
import { DeliveryShell } from '@/features/delivery/delivery-shell';

export default function DeliveryLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <DeliveryShell>{children}</DeliveryShell>
    </Suspense>
  );
}
