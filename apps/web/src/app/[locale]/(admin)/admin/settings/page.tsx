'use client';
// /admin/settings — Figma "ADM-13 — Platform admin — platform settings (flags, app versions, legal, Meta, providers)".
import { Suspense } from 'react';
import { SettingsPage } from '@/features/admin-ops/settings-page';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SettingsPage />
    </Suspense>
  );
}
