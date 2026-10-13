'use client';
// 404 of the public site (PUB-04): unpublished / unknown CMS page, unknown help guide — inside the PublicLayout.
import { PublicNotFound } from '@/features/public/shared';

export default function NotFound() {
  return <PublicNotFound />;
}
