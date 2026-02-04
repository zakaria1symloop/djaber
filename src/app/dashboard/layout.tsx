'use client';

import { ReactNode, useEffect, useState } from 'react';
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
} from '@/components/ui';
import { getUnreadCount } from '@/lib/notifications-api';

const navigationItems = [
  { id: 'overview', name: 'Overview', icon: HomeIcon, href: '/dashboard' },
  { id: 'social-media', name: 'Social Media', icon: ChatIcon, href: '/dashboard', section: 'pages' },
  { id: 'services', name: 'Services', icon: GridIcon, href: '/dashboard/services' },
  { id: 'notifications', name: 'Notifications', icon: BellIcon, href: '/dashboard/notifications' },
  { id: 'analytics', name: 'Analytics', icon: ChartIcon, href: '/dashboard', section: 'analytics' },
  { id: 'settings', name: 'Settings', icon: SettingsIcon, href: '/dashboard', section: 'settings' },
];

const serviceSubItems = [
  { id: 'products', name: 'Products', icon: BoxIcon, href: '/dashboard/stock', active: true },
  { id: 'agents', name: 'Agents', icon: BotIcon, href: '/dashboard/agents', active: true },
  { id: 'sales', name: 'Sales', icon: ShoppingCartIcon, href: null, active: false },
  { id: 'commercial', name: 'Commercial', icon: MegaphoneIcon, href: null, active: false },
];

const stockNavItems = [
  { href: '/dashboard/stock', label: 'Overview', icon: HomeIcon },
  { href: '/dashboard/stock/products', label: 'Products', icon: BoxIcon },
  { href: '/dashboard/stock/categories', label: 'Categories', icon: TagIcon },
  { href: '/dashboard/stock/suppliers', label: 'Suppliers', icon: UsersIcon },
  { href: '/dashboard/stock/clients', label: 'Clients', icon: UsersIcon },
  { href: '/dashboard/stock/orders', label: 'Orders', icon: ClipboardIcon },
  { href: '/dashboard/stock/delivery', label: 'Delivery', icon: TruckIcon },
  { href: '/dashboard/stock/sales', label: 'Sales', icon: ShoppingCartIcon },
  { href: '/dashboard/stock/purchases', label: 'Purchases', icon: TruckIcon },
  { href: '/dashboard/stock/movements', label: 'Movements', icon: HistoryIcon },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { pages } = usePages();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [servicesExpanded, setServicesExpanded] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Poll for unread notifications count
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchCount = () => {
      getUnreadCount()
        .then((data) => setUnreadCount(data.count))
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

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

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  const isStockRoute = pathname?.startsWith('/dashboard/stock');
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
    } else if (item.section) {
      router.push(`/dashboard?section=${item.section}`);
    } else {
      router.push(item.href);
    }
    setSidebarOpen(false);
  };

  const getHeaderTitle = () => {
    if (isNotificationsRoute) return 'Notifications';
    if (isStockRoute) return 'Products';
    if (isServicesRoute) return 'Services';
    if (activeNavId === 'social-media') return 'Social Media';
    if (activeNavId && activeNavId !== 'overview') {
      return activeNavId.charAt(0).toUpperCase() + activeNavId.slice(1);
    }
    return '';
  };

  return (
    <>
      {/* Sidebar */}
      <aside
        onMouseEnter={() => sidebarCollapsed && setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        className={`fixed top-0 left-0 h-full bg-black border-r border-white/10 z-50 transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 ${isCollapsedMode ? 'w-16' : 'w-64'}`}
      >
        <div className={`p-6 border-b border-white/10 ${isCollapsedMode ? 'px-3 py-4' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0">
              <span className="text-black font-bold text-xl" style={{ fontFamily: 'Syne, sans-serif' }}>D</span>
            </div>
            {!isCollapsedMode && (
              <div>
                <h1 className="text-white font-bold text-lg" style={{ fontFamily: 'Syne, sans-serif' }}>Djaber.ai</h1>
                <p className="text-xs text-zinc-500">AI Social Agent</p>
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
                              Soon
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
                <span className="text-xs text-zinc-400">Your Plan</span>
                <Badge variant="default" size="sm">{user?.plan || 'Free'}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Pages</span>
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
          isStockRoute ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ left: isCollapsedMode ? '64px' : '256px' }}
      >
        <div className="p-4 border-b border-white/10">
          <button
            onClick={() => router.push('/dashboard/services')}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-3"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            <span>Back to Services</span>
          </button>
          <h2 className="text-sm font-semibold text-white">Products</h2>
        </div>
        <nav className="p-2 space-y-0.5 flex-1">
          {stockNavItems.map((item) => {
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
        className={`fixed top-0 left-0 right-0 z-30 bg-black/80 backdrop-blur-sm border-b border-white/10 transition-[padding] duration-300 ease-in-out ${
          isStockRoute
            ? (isCollapsedMode ? 'lg:pl-[288px]' : 'lg:pl-[480px]')
            : 'lg:pl-64'
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
              {/* Bell icon */}
              <button
                onClick={() => router.push('/dashboard/notifications')}
                className="relative p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <BellIcon className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
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
                      {user?.plan || 'Free'} Plan
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
                      Settings
                    </button>
                    <button
                      onClick={() => router.push('/')}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                    >
                      <HomeIcon className="w-4 h-4" />
                      Back to Home
                    </button>
                  </div>
                  <div className="p-2 border-t border-white/10">
                    <button
                      onClick={() => {
                        localStorage.removeItem('token');
                        router.push('/login');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <LogoutIcon className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`min-h-screen pt-20 pb-20 px-4 sm:px-6 lg:px-8 bg-black transition-[margin] duration-300 ease-in-out ${
        isStockRoute
          ? (isCollapsedMode ? 'lg:ml-[288px]' : 'lg:ml-[480px]')
          : 'lg:ml-64'
      }`}>
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </>
  );
}
