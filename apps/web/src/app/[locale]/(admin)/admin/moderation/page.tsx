'use client';
// /admin/moderation — Figma "ADM-10 — Platform admin — moderation queue (products) + review panel"
// (reviewed item = ?sheet=<id>, "Mots & catégories interdits" = ?panel=rules).
import { Suspense } from 'react';
import { ModerationPage } from '@/features/admin-moderation/moderation-page';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ModerationPage />
    </Suspense>
  );
}
