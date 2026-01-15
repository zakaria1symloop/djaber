'use client';

import { ReactNode } from 'react';
import PageTransition from './PageTransition';
import Header from './Header';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/contexts/AuthContext';
import { PagesProvider } from '@/contexts/PagesContext';

export default function ClientLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  return (
    <AuthProvider>
      <PagesProvider>
        {/* Background effects - only on non-auth pages */}
        {!isAuthPage && (
          <>
            <div className="gradient-bg" />
            <div className="grid-pattern" />
            <div className="noise-overlay" />
          </>
        )}

        {!isAuthPage && <Header />}

        <PageTransition>
          {children}
        </PageTransition>
      </PagesProvider>
    </AuthProvider>
  );
}
