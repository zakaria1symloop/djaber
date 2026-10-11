// /categories — Figma "CAT-04 — Categories & units — list + edit sheet + reassign dialog".
import { Suspense } from 'react';
import { CategoriesView } from '@/features/catalog/categories/categories-view';

export default function CategoriesPage() {
  return (
    <Suspense fallback={null}>
      <CategoriesView />
    </Suspense>
  );
}
