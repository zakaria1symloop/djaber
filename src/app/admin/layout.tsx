'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
  ChartIcon,
  UsersIcon,
  BoxIcon,
  ChatIcon,
  SettingsIcon,
  BoltIcon,
} from '@/components/ui/icons';

const adminNavItems = [
  { href: '/admin', label: 'Overview', icon: ChartIcon, exact: true },
  { href: '/admin/analytics', label: 'Analytics', icon: ChartIcon },
  { href: '/admin/ai-providers', label: 'AI Providers', icon: BoltIcon },
  { href: '/admin/users', label: 'Users', icon: UsersIcon },
  { href: '/admin/products', label: 'Products', icon: BoxIcon },
  { href: '/admin/conversations', label: 'Conversations', icon: ChatIcon },
  { href: '/admin/settings', label: 'Settings', icon: SettingsIcon },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (!user?.isAdmin) {
      router.replace('/dashboard');
    }
  }, [authLoading, isAuthenticated, user, router]);

  if (authLoading || !isAuthenticated || !user?.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-zinc-400 text-sm">Verifying admin access…</div>
      </div>
    );
  }

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname?.startsWith(href + '/');

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-zinc-950 border-r border-white/10 flex flex-col z-40">
        {/* Brand */}
        <div className="px-6 py-5 border-b border-white/10">
          <Link href="/admin" className="block">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
                <span className="text-xs font-bold text-white">A</span>
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
                  Admin
                </p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Platform</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-xs font-bold">
              {user.firstName?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user.firstName} {user.lastName}</p>
              <p className="text-[10px] text-zinc-500 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={() => { logout(); router.push('/login'); }}
            className="w-full px-2 py-1.5 text-[11px] text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-64 min-h-screen">
        <div className="px-6 lg:px-10 py-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
