'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { Avatar } from '@/components/ui';
import {
  ChartIcon,
  UsersIcon,
  BoxIcon,
  ChatIcon,
  SettingsIcon,
  BoltIcon,
  MenuIcon,
  LogoutIcon,
  HomeIcon,
  StarIcon,
  DollarIcon,
  GlobeIcon,
  FileTextIcon,
} from '@/components/ui/icons';

const adminNavItemsBase = [
  { href: '/admin/analytics', labelKey: 'nav.admin.analytics', icon: ChartIcon },
  { href: '/admin/users', labelKey: 'nav.admin.users', icon: UsersIcon },
  { href: '/admin/plans', labelKey: 'nav.admin.plans', icon: StarIcon },
  { href: '/admin/subscriptions', labelKey: 'nav.admin.subscriptions', icon: DollarIcon },
  { href: '/admin/ai-providers', labelKey: 'nav.admin.ai', icon: BoltIcon },
  { href: '/admin/products', labelKey: 'nav.admin.products', icon: BoxIcon },
  { href: '/admin/conversations', labelKey: 'nav.admin.conversations', icon: ChatIcon },
  { href: '/admin/company', labelKey: 'nav.admin.company', icon: GlobeIcon },
  { href: '/admin/legal', labelKey: 'nav.admin.legal', icon: FileTextIcon },
  { href: '/admin/settings', labelKey: 'nav.admin.settings', icon: SettingsIcon },
] as const;

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const { t, dir } = useTranslation();
  const adminNavItems = adminNavItemsBase.map((i) => ({ ...i, label: t(i.labelKey) }));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

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

  // Close user menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showUserMenu && !target.closest('.admin-user-menu')) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  if (authLoading || !isAuthenticated || !user?.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black" dir={dir}>
        <div className="text-zinc-400 text-sm">{t('admin.verifying')}</div>
      </div>
    );
  }

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

  const activeItem = adminNavItems.find((item) => isActive(item.href));
  const headerTitle = activeItem?.label || t('admin.defaultTitle');

  return (
    <>
      {/* Sidebar */}
      <aside
        className={`fixed top-0 start-0 h-full w-64 bg-black border-e border-white/10 z-50 transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : 'max-lg:rtl:translate-x-full max-lg:-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0">
              <span className="text-black font-bold text-xl" style={{ fontFamily: 'Syne, sans-serif' }}>D</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>
                Djaber.ai
              </h1>
              <p className="text-xs text-zinc-500">{t('admin.tagline')}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="p-3 space-y-1">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <button
                key={item.href}
                onClick={() => {
                  router.push(item.href);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  active
                    ? 'bg-white text-black'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer card */}
        <div className="absolute bottom-0 start-0 end-0 p-4 border-t border-white/10">
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-zinc-500">{t('admin.role')}</span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/10 text-white uppercase tracking-wider">
                {t('admin.role.label')}
              </span>
            </div>
            <p className="text-xs text-white truncate">{user.email}</p>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Header */}
      <header className="fixed top-0 start-0 end-0 z-30 bg-black/80 backdrop-blur-sm border-b border-white/10 lg:ps-64">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden text-zinc-400 hover:text-white transition-colors"
            >
              <MenuIcon className="w-6 h-6" />
            </button>

            <h1 className="text-base font-medium text-white">{headerTitle}</h1>

            <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <LanguageSwitcher compact />
            </div>
            <div className="relative admin-user-menu">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all"
              >
                <div className="hidden sm:block text-end">
                  <p className="text-sm font-medium text-white">{user.firstName} {user.lastName}</p>
                  <p className="text-xs text-zinc-400">{user.email}</p>
                </div>
                <Avatar initials={`${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`} size="md" />
              </button>

              {showUserMenu && (
                <div className="absolute end-0 mt-2 w-64 bg-zinc-900 border border-white/10 rounded-xl shadow-xl overflow-hidden">
                  <div className="p-4 border-b border-white/10">
                    <p className="text-sm font-semibold text-white">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-zinc-400 mt-1">{user.email}</p>
                    <span className="inline-block mt-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/10 text-white uppercase tracking-wider">
                      {t('admin.role.full')}
                    </span>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => {
                        router.push('/admin/settings');
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                    >
                      <SettingsIcon className="w-4 h-4" />
                      {t('menu.settings')}
                    </button>
                    <button
                      onClick={() => router.push('/')}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                    >
                      <HomeIcon className="w-4 h-4" />
                      {t('menu.backHome')}
                    </button>
                  </div>
                  <div className="p-2 border-t border-white/10">
                    <button
                      onClick={() => {
                        logout();
                        router.push('/login');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <LogoutIcon className="w-4 h-4" />
                      {t('menu.signout')}
                    </button>
                  </div>
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="min-h-screen pt-28 pb-20 px-4 sm:px-6 lg:px-8 bg-black lg:ms-64">
        {children}
      </main>
    </>
  );
}
