'use client';
// /products/[id] — Figma "CAT-09 — Product page — full (gallery, variants, stock, margins, agents, movements, archived)"
// + "MOD — Product — rejected view + appeal dialog (merchant)".
import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { ProductPage } from '@/features/catalog/product-page/product-page';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense fallback={null}>
      <ProductPage key={id} id={id} />
    </Suspense>
  );
}
