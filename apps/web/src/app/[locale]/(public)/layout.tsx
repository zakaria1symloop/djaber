import type { ReactNode } from 'react';
import { PublicFooter } from '@/components/public-footer';
import { PublicHeader } from '@/components/public-header';

// PublicLayout (02-next-route-map §1, PUB-01): header (logo, Fonctionnalités · Tarifs · Aide · Statut, FR · AR · EN,
// Se connecter, Essai gratuit 14 j), full-bleed sections inside `main`, footer. Server-rendered pages, no session needed.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
