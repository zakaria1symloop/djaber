'use client';

import { ReactNode, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePages } from '@/contexts/PagesContext';
import {
  Card,
  Badge,
  Avatar,
  HomeIcon,
  ChatIcon,
  ChartIcon,
  SettingsIcon,
  MenuIcon,
  LogoutIcon,
  BoxIcon,
  TagIcon,
  UsersIcon,
  ShoppingCartIcon,
  TruckIcon,
  HistoryIcon,
  ChevronLeftIcon,
  ChevronDownIcon,
  GridIcon,
  BotIcon,
  MegaphoneIcon,
  ClipboardIcon,
  BellIcon,
  BoltIcon,
  DollarIcon,
} from '@/components/ui';
import { getUnreadCount } from '@/lib/notifications-api';
import { getCreditStatus } from '@/lib/user-stock-api';
import { FilterPanelProvider, useFilterPanel } from '@/contexts/FilterPanelContext';
import { useTranslation } from '@/contexts/LanguageContext';

const navigationItemsBase = [
  { id: 'overview', labelKey: 'nav.dash.overview', icon: HomeIcon, href: '/dashboard' },
  { id: 'social-media', labelKey: 'nav.dash.social', icon: ChatIcon, href: '/dashboard', section: 'pages' },
  { id: 'services', labelKey: 'nav.dash.services', icon: GridIcon, href: '/dashboard/services' },
  { id: 'notifications', labelKey: 'nav.dash.notifications', icon: BellIcon, href: '/dashboard/notifications' },
  { id: 'analytics', labelKey: 'nav.dash.analytics', icon: ChartIcon, href: '/dashboard', section: 'analytics' },
  { id: 'settings', labelKey: 'nav.dash.settings', icon: SettingsIcon, href: '/dashboard', section: 'settings' },
] as const;

const serviceSubItemsBase = [
  { id: 'products', labelKey: 'nav.dash.products', icon: BoxIcon, href: '/dashboard/stock', active: true },
  { id: 'agents', labelKey: 'nav.dash.agents', icon: BotIcon, href: '/dashboard/agents', active: true },
  { id: 'sales', labelKey: 'nav.dash.sales', icon: ShoppingCartIcon, href: null, active: false },
  { id: 'commercial', labelKey: 'nav.dash.commercial', icon: MegaphoneIcon, href: null, active: false },
] as const;

const stockNavItemsBase = [
  { href: '/dashboard/stock', labelKey: 'nav.dash.overview', icon: HomeIcon, simple: true },
  { href: '/dashboard/stock/products', labelKey: 'nav.dash.products', icon: BoxIcon, simple: true },
  { href: '/dashboard/stock/categories', labelKey: 'nav.dash.categories', icon: TagIcon, simple: true },
  { href: '/dashboard/stock/suppliers', labelKey: 'nav.dash.suppliers', icon: UsersIcon, simple: false },
  { href: '/dashboard/stock/clients', labelKey: 'nav.dash.clients', icon: UsersIcon, simple: false },
  { href: '/dashboard/stock/recommendations', labelKey: 'nav.dash.crossSell', icon: BoltIcon, simple: false },
  { href: '/dashboard/stock/caisse', labelKey: 'nav.dash.caisse', icon: DollarIcon, simple: false },
  { href: '/dashboard/stock/orders', labelKey: 'nav.dash.orders', icon: ClipboardIcon, simple: true },
  { href: '/dashboard/stock/delivery', labelKey: 'nav.dash.delivery', icon: TruckIcon, simple: false },
  { href: '/dashboard/stock/sales', labelKey: 'nav.dash.sales', icon: ShoppingCartIcon, simple: false },
  { href: '/dashboard/stock/purchases', labelKey: 'nav.dash.purchases', icon: TruckIcon, simple: false },
  { href: '/dashboard/stock/movements', labelKey: 'nav.dash.movements', icon: HistoryIcon, simple: false },
] as const;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <FilterPanelProvider>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black"><div className="text-white">Loading...</div></div>}>
        <DashboardLayoutInner>{children}</DashboardLayoutInner>
      </Suspense>
    </FilterPanelProvider>
  );
}

function DashboardLayoutInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const { pages } = usePages();
  const { filterPanelOpen, setFilterPanelOpen } = useFilterPanel();
  const { t, dir } = useTranslation();
  const navigationItems = navigationItemsBase.map((i) => ({ ...i, name: t(i.labelKey) }));
  const serviceSubItems = serviceSubItemsBase.map((i) => ({ ...i, name: t(i.labelKey) }));
  const stockNavItemsRaw = stockNavItemsBase.map((i) => ({ ...i, label: t(i.labelKey) }));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [servicesExpanded, setServicesExpanded] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [urgentAlert, setUrgentAlert] = useState(false);
  const prevUnreadRef = useRef(0);
  const [stockMode, setStockMode] = useState<'simple' | 'advanced'>('simple');
  const [credits, setCredits] = useState<{ used: number; limit: number; remaining: number; percentage: number } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    // Admins live in /admin only — keep them out of the user dashboard.
    if (user?.isAdmin) {
      router.replace('/admin');
    }
  }, [isAuthenticated, authLoading, user, router]);

  // Poll for unread notifications count + trigger urgent alerts
  const playAlertSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      // Two-tone alert beep
      [520, 680].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.3);
      });
    } catch {}
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchCount = () => {
      getUnreadCount()
        .then((data) => {
          const newCount = data.count;
          // If count increased, trigger alert sound
          if (newCount > prevUnreadRef.current && prevUnreadRef.current >= 0) {
            playAlertSound();
          }
          // Keep pulsing as long as there are unread notifications
          setUrgentAlert(newCount > 0);
          prevUnreadRef.current = newCount;
          setUnreadCount(newCount);
        })
        .catch(() => {});
    };
    // First fetch — set baseline without alerting
    getUnreadCount()
      .then((data) => {
        prevUnreadRef.current = data.count;
        setUnreadCount(data.count);
      })
      .catch(() => {});
    // Also fetch credits
    getCreditStatus().then(setCredits).catch(() => {});
    const interval = setInterval(() => {
      fetchCount();
      getCreditStatus().then(setCredits).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated, playAlertSound]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showUserMenu && !target.closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  // Stock mode from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('stockMode');
    if (saved === 'simple' || saved === 'advanced') setStockMode(saved);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'stockMode' && (e.newValue === 'simple' || e.newValue === 'advanced')) {
        setStockMode(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Route guard: redirect to stock overview if on advanced-only route in simple mode
  const isStockRoute = pathname?.startsWith('/dashboard/stock');
  const filteredStockNavItems = stockMode === 'simple'
    ? stockNavItemsRaw.filter(item => item.simple)
    : stockNavItemsRaw;

  useEffect(() => {
    if (stockMode === 'simple' && isStockRoute && pathname !== '/dashboard/stock') {
      const isAllowed = filteredStockNavItems.some(
        item => pathname === item.href || pathname?.startsWith(item.href + '/')
      );
      if (!isAllowed) router.replace('/dashboard/stock');
    }
  }, [stockMode, pathname, isStockRoute, filteredStockNavItems, router]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black" dir={dir}>
        <div className="text-white">{t('dash.loading')}</div>
      </div>
    );
  }

  const isAgentsRoute = pathname?.startsWith('/dashboard/agents');
  const isServicesRoute = pathname === '/dashboard/services';
  const isNotificationsRoute = pathname?.startsWith('/dashboard/notifications');
  const isDashboardRoot = pathname === '/dashboard';
  const section = searchParams.get('section');

  // Auto-expand services accordion when on services or stock routes
  const isServicesOrStockActive = isStockRoute || isAgentsRoute || isServicesRoute;
  const showServicesExpanded = servicesExpanded || isServicesOrStockActive;

  // Sidebar collapse: collapses on stock routes, expands on hover (pushing content)
  const sidebarCollapsed = isStockRoute;
  const isCollapsedMode = sidebarCollapsed && !sidebarHovered;

  const getActiveId = () => {
    if (isNotificationsRoute) return 'notifications';
    if (isStockRoute) return 'services';
    if (isAgentsRoute) return 'services';
    if (isServicesRoute) return 'services';
    if (isDashboardRoot) {
      if (section === 'pages') return 'social-media';
      if (section === 'analytics') return 'analytics';
      if (section === 'settings') return 'settings';
      return 'overview';
    }
    return '';
  };
  const activeNavId = getActiveId();

  const handleNavClick = (item: typeof navigationItems[0]) => {
    if (item.id === 'services') {
      setServicesExpanded(!servicesExpanded);
      router.push('/dashboard/services');
    } else if ('section' in item && item.section) {
      router.push(`/dashboard?section=${item.section}`);
    } else {
      router.push(item.href);
    }
    setSidebarOpen(false);
  };

  const getHeaderTitle = () => {
    if (isNotificationsRoute) return t('nav.dash.notifications');
    if (isStockRoute) return t('nav.dash.products');
    if (isServicesRoute) return t('nav.dash.services');
    if (activeNavId === 'social-media') return t('nav.dash.social');
    if (activeNavId === 'analytics') return t('nav.dash.analytics');
    if (activeNavId === 'settings') return t('nav.dash.settings');
    return '';
  };

  return (
    <>
      {/* Sidebar */}
      <aside
        onMouseEnter={() => sidebarCollapsed && setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        className={`fixed top-0 left-0 h-full bg-black border-r border-white/10 z-50 transition-all duration-300 ease-in-out ${
          filterPanelOpen ? '-translate-x-full' : sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${filterPanelOpen ? '' : 'lg:translate-x-0'} ${isCollapsedMode ? 'w-16' : 'w-64'}`}
      >
        <div className={`p-6 border-b border-white/10 ${isCollapsedMode ? 'px-3 py-4' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0">
              <span className="text-black font-bold text-xl" style={{ fontFamily: 'Syne, sans-serif' }}>D</span>
            </div>
            {!isCollapsedMode && (
              <div>
                <h1 className="text-white font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>Djaber.ai</h1>
                <p className="text-xs text-zinc-500">{t('dash.tagline')}</p>
              </div>
            )}
          </div>
        </div>

        <nav className={`p-3 space-y-1 ${isCollapsedMode ? 'px-2' : ''}`}>
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeNavId;
            const isServices = item.id === 'services';
            const badge = item.id === 'social-media' ? pages.length : (item.id === 'notifications' && unreadCount > 0) ? unreadCount : undefined;

            return (
              <div key={item.id}>
                <button
                  data-nav-id={item.id}
                  onClick={() => handleNavClick(item)}
                  className={`dashboard-nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${
                    isCollapsedMode ? 'px-0 justify-center' : ''
                  } ${
                    isActive
                      ? 'bg-white text-black'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                  title={isCollapsedMode ? item.name : undefined}
                >
                  <div className={`flex items-center gap-3 ${isCollapsedMode ? 'gap-0' : ''}`}>
                    <Icon className="w-5 h-5 shrink-0" />
                    {!isCollapsedMode && <span className="font-medium">{item.name}</span>}
                  </div>
                  {!isCollapsedMode && badge !== undefined && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      item.id === 'notifications'
                        ? 'bg-red-500 text-white'
                        : isActive ? 'bg-black/10' : 'bg-white/10'
                    }`}>
                      {badge}
                    </span>
                  )}
                  {!isCollapsedMode && isServices && (
                    <ChevronDownIcon
                      className={`w-4 h-4 transition-transform duration-200 ${
                        showServicesExpanded ? 'rotate-180' : ''
                      } ${isActive ? 'text-black/60' : 'text-zinc-600'}`}
                    />
                  )}
                </button>

                {/* Services accordion sub-items */}
                {isServices && showServicesExpanded && !isCollapsedMode && (
                  <div className="mt-1 ml-4 pl-4 border-l border-white/10 space-y-0.5">
                    {serviceSubItems.map((sub) => {
                      const SubIcon = sub.icon;
                      const isSubActive = (sub.id === 'products' && isStockRoute) || (sub.id === 'agents' && pathname?.startsWith('/dashboard/agents'));

                      return (
                        <button
                          key={sub.id}
                          onClick={() => {
                            if (sub.href) {
                              router.push(sub.href);
                              setSidebarOpen(false);
                            }
                          }}
                          disabled={!sub.active}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm transition-all ${
                            isSubActive
                              ? 'bg-white/10 text-white'
                              : sub.active
                                ? 'text-zinc-500 hover:text-white hover:bg-white/5 cursor-pointer'
                                : 'text-zinc-600 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <SubIcon className="w-4 h-4" />
                            <span className="font-medium">{sub.name}</span>
                          </div>
                          {!sub.active && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/5 text-zinc-500">
                              {t('nav.dash.soon')}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {!isCollapsedMode && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
            <Card variant="default" padding="sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-400">{t('dash.yourPlan')}</span>
                <Badge variant="default" size="sm">{user?.plan || t('pricing.free')}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">{t('dash.pages')}</span>
                <span className="text-xs font-semibold text-white">{pages.length} / 10</span>
              </div>
            </Card>
          </div>
        )}
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Stock Sub-Sidebar: pushed by main sidebar */}
      <aside
        className={`hidden lg:flex fixed top-0 h-full w-56 bg-zinc-950 border-r border-white/10 z-40 flex-col transition-all duration-300 ease-in-out ${
          filterPanelOpen ? '-translate-x-full' : isStockRoute ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ left: filterPanelOpen ? '0px' : isCollapsedMode ? '64px' : '256px' }}
      >
        <div className="p-4 border-b border-white/10">
          <button
            onClick={() => router.push('/dashboard/services')}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-3"
          >
            <ChevronLeftIcon className={`w-4 h-4 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
            <span>{t('nav.dash.backServices')}</span>
          </button>
          <h2 className="text-sm font-semibold text-white">{t('nav.dash.products')}</h2>
        </div>
        <nav className="p-2 space-y-0.5 flex-1">
          {filteredStockNavItems.map((item) => {
            const isActiveStock = pathname === item.href || (item.href !== '/dashboard/stock' && pathname?.startsWith(item.href));
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                  isActiveStock
                    ? 'bg-white/10 text-white'
                    : 'text-zinc-500 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Header */}
      <header
        className={`fixed top-0 left-0 z-30 bg-black/80 backdrop-blur-sm border-b border-white/10 transition-all duration-300 ease-in-out ${
          filterPanelOpen
            ? 'lg:pl-0 right-[336px]'
            : isStockRoute
              ? (isCollapsedMode ? 'lg:pl-[288px] right-0' : 'lg:pl-[480px] right-0')
              : 'lg:pl-64 right-0'
        }`}
      >
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden text-zinc-400 hover:text-white transition-colors"
            >
              <MenuIcon className="w-6 h-6" />
            </button>

            <h1 className="text-base font-medium text-white capitalize">
              {getHeaderTitle()}
            </h1>

            <div className="flex items-center gap-2">
              {/* Credits pill */}
              {credits && (
                <div
                  className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border cursor-default ${
                    credits.percentage >= 100
                      ? 'bg-red-500/10 text-red-400 border-red-500/20'
                      : credits.percentage >= 80
                        ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                        : 'bg-white/5 text-zinc-400 border-white/10'
                  }`}
                  title={`${credits.used} / ${credits.limit} credits used`}
                >
                  <span className="text-[10px]">⚡</span>
                  {credits.remaining.toLocaleString()} / {credits.limit.toLocaleString()}
                </div>
              )}

              {/* Bell icon with urgent alert orbs */}
              <button
                onClick={() => {
                  setUrgentAlert(false);
                  router.push('/dashboard/notifications');
                }}
                className="relative p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <BellIcon className={`w-5 h-5 ${urgentAlert ? 'text-red-400' : ''}`} />
                {unreadCount > 0 && (
                  <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ${urgentAlert ? 'animate-ping' : ''}`} />
                )}
                {/* Urgent red orbs */}
                {urgentAlert && (
                  <>
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500/40 blur-sm animate-ping" />
                    <span className="absolute -top-0.5 -left-0.5 w-3 h-3 rounded-full bg-red-500/30 blur-sm animate-ping" style={{ animationDelay: '0.3s' }} />
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500/20 blur-sm animate-ping" style={{ animationDelay: '0.6s' }} />
                  </>
                )}
              </button>

            <div className="relative user-menu-container">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all"
              >
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium text-white">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-zinc-400">{user?.email}</p>
                </div>
                <Avatar initials={`${user?.firstName?.[0]}${user?.lastName?.[0]}`} size="md" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-zinc-900 border border-white/10 rounded-xl shadow-xl overflow-hidden">
                  <div className="p-4 border-b border-white/10">
                    <p className="text-sm font-semibold text-white">{user?.firstName} {user?.lastName}</p>
                    <p className="text-xs text-zinc-400 mt-1">{user?.email}</p>
                    <Badge variant="info" size="sm" className="mt-2">
                      {user?.plan || t('pricing.free')} {t('menu.plan')}
                    </Badge>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => {
                        router.push('/dashboard?section=settings');
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

      {/* Click-outside overlay to close filter panel */}
      {filterPanelOpen && (
        <div
          className="fixed inset-0 cursor-pointer"
          style={{ right: '336px', zIndex: 36 }}
          onClick={() => setFilterPanelOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className={`min-h-screen pt-28 pb-20 px-4 sm:px-6 lg:px-8 bg-black transition-all duration-300 ease-in-out ${
        filterPanelOpen
          ? 'lg:ml-0 mr-[336px]'
          : isStockRoute
            ? (isCollapsedMode ? 'lg:ml-[288px]' : 'lg:ml-[480px]')
            : 'lg:ml-64'
      }`}>
        {/* Credit warning bars */}
        {credits && credits.percentage >= 100 && (
          <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-red-400 text-sm font-medium">⚠️ {t('dash.creditsExhausted')}</span>
            </div>
            <button
              onClick={() => router.push('/dashboard?section=settings')}
              className="px-3 py-1 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600 transition-colors"
            >
              {t('dash.upgradePlan')}
            </button>
          </div>
        )}
        {credits && credits.percentage >= 80 && credits.percentage < 100 && (
          <div className="mb-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-yellow-400 text-sm font-medium">⚡ {credits.remaining} {t('dash.creditsRemaining')}</span>
            </div>
            <button
              onClick={() => router.push('/dashboard?section=settings')}
              className="px-3 py-1 bg-yellow-500 text-black text-xs font-semibold rounded-lg hover:bg-yellow-400 transition-colors"
            >
              {t('dash.upgrade')}
            </button>
          </div>
        )}
        {children}
      </main>
    </>
  );
}
