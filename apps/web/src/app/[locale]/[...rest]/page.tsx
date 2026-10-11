import { notFound } from 'next/navigation';

// Unknown paths render the localized GLOBAL 404 (not-found.tsx of the locale layout).
export default function CatchAll() {
  notFound();
}
