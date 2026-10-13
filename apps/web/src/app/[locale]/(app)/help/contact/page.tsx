'use client';
// /help/contact — "Contacter le support" (HELP-03).
import { Suspense } from 'react';
import { ContactPage } from '@/features/help/contact-page';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ContactPage />
    </Suspense>
  );
}
