'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  if (isAuthPage) {
    return <div className="contents">{children}</div>;
  }

  return <>{children}</>;
}
