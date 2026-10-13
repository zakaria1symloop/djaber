'use client';
// /reports/[key] — Figma "ANA-04 — Report — template (Ventes par produit) + large export banner".
import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { ReportPage } from '@/features/reports/report-page';

export default function Page() {
  const { key } = useParams<{ key: string }>();
  return (
    <Suspense fallback={null}>
      <ReportPage reportKey={key} />
    </Suspense>
  );
}
