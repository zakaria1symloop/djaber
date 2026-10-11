// /products/import — Figma "CAT-06 — Import wizard — preview with row errors" + DLG GDS I "Correspondance des colonnes".
import { Suspense } from 'react';
import { ImportWizard } from '@/features/catalog/import/import-wizard';

export default function ProductsImportPage() {
  return (
    <Suspense fallback={null}>
      <ImportWizard />
    </Suspense>
  );
}
