'use client';
// /products/new — Figma "CAT-01 — Product form — edit with variants" (create variant of the same frame), DLG GDS II
// "Créer depuis une photo" / "Images — erreurs inline" / "Limite du plan atteinte". `?type=service` preselects
// "Suivre le stock" off (Services list). Permission `catalog.write`.
import { ProductForm } from '@/features/catalog/product-form/product-form';

export default function NewProductPage() {
  return <ProductForm mode="create" />;
}
