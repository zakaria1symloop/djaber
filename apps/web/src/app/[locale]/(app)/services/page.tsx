// /services — Figma "CAT-11 / GDS-06b — Services list · New purchase form · Purchase & sale detail" (services list).
import { Suspense } from 'react';
import { ServicesList } from '@/features/catalog/services/services-list';

export default function ServicesPage() {
  return (
    <Suspense fallback={null}>
      <ServicesList />
    </Suspense>
  );
}
