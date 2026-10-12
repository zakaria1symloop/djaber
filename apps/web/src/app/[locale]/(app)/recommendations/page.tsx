'use client';
// /recommendations — Figma "GDS-10 — Recommendations — list + generate job + stats" + DLG GDS II "Règle de recommandation".
import { Suspense } from 'react';
import { RecommendationsPage } from '@/features/gds/recommendations';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RecommendationsPage />
    </Suspense>
  );
}
