'use client';
// /suppliers — Figma "GDS-06 — Suppliers — list + detail sheet" (sheet = ?sheet=<id>).
import { Suspense } from 'react';
import { SuppliersPage } from '@/features/gds/suppliers';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SuppliersPage />
    </Suspense>
  );
}
