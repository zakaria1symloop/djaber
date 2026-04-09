'use client';

import { ReactNode } from 'react';
import PageTransition from './PageTransition';
import Header from './Header';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/contexts/AuthContext';
import { PagesProvider } from '@/contexts/PagesContext';
import { ToastProvider } from '@/components/ui/Toast';

export default function ClientLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password';
  const isDashboard = pathname?.startsWith('/dashboard');
  const isAdmin = pathname?.startsWith('/admin');
  const isAppArea = isAuthPage || isDashboard || isAdmin;

  return (
    <AuthProvider>
      <PagesProvider>
        <ToastProvider>
          {/* Marketing background effects — only on public marketing pages */}
          {!isAppArea && (
            <>
              <div className="gradient-bg" />
              <div className="grid-pattern" />
              <div className="noise-overlay" />
            </>
          )}

          {/* Marketing header — only on public marketing pages */}
          {!isAppArea && <Header />}

          <PageTransition>
            {children}
          </PageTransition>
        </ToastProvider>
      </PagesProvider>
    </AuthProvider>
  );
}
