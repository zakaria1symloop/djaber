'use client';
// /products/[id]/edit — Figma "CAT-01 — Product form — edit with variants", "CAT-01 — Product form — AR (RTL)",
// "MOD — Merchant side — product moderation states" (form banner). States: skeleton (same blocks), 404 / 403 / error,
// then the form (archived ⇒ read-only with "Restaurer"). Permission `catalog.write`.
import { Skeleton } from '@djaber/ui';
import { useParams } from 'next/navigation';
import { AppPage } from '@/components/app-page';
import { QueryError } from '@/components/global-states';
import { useProduct } from '@/features/catalog/api';
import { ProductForm } from '@/features/catalog/product-form/product-form';
import { useLocaleCode, useT } from '@/lib/i18n';

export default function EditProductPage() {
  const t = useT();
  const locale = useLocaleCode();
  const { id } = useParams<{ id: string }>();
  const product = useProduct(id);
  if (product.data) return <ProductForm key={product.data.id} mode="edit" product={product.data} />;
  return (
    <AppPage permission="catalog.write" back={{ href: '/products', label: t('nav.products') }} title={t('products.form.editTitle')}>
      {product.isError ? (
        <QueryError error={product.error} onRetry={() => product.refetch()} backHref={`/${locale}/products`} />
      ) : (
        <div role="status" aria-label={t('common.loading')} className="grid items-start gap-5 lg:grid-cols-3" data-testid="product-form-skeleton">
          <div className="flex flex-col gap-5 lg:col-span-2">
            <Skeleton className="h-64 rounded-card" />
            <Skeleton className="h-36 rounded-card" />
            <Skeleton className="h-56 rounded-card" />
          </div>
          <div className="flex flex-col gap-5">
            <Skeleton className="h-72 rounded-card" />
            <Skeleton className="h-64 rounded-card" />
            <Skeleton className="h-24 rounded-card" />
          </div>
        </div>
      )}
    </AppPage>
  );
}
