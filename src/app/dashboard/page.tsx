'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePages } from '@/contexts/PagesContext';
import { useTranslation } from '@/contexts/LanguageContext';
import {
  Button,
  Card,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Input,
  EmptyState,
  FacebookIcon,
  PlusIcon,
  SettingsIcon,
  CloseIcon,
  ChatIcon,
  ChartIcon,
  ClockIcon,
  BoltIcon,
  GlobeIcon,
  MessageIcon,
  BoxIcon,
} from '@/components/ui';
import {
  DollarIcon,
  ShoppingCartIcon,
  TruckIcon,
  TagIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  AlertIcon,
  RefreshIcon,
  PackageIcon,
  UsersIcon,
  SparklesIcon,
} from '@/components/ui/icons';
import {
  getStockDashboard,
  getSalesStats,
  getPurchaseStats,
  getOrderStats,
  getPublicPlans,
  createCheckout,
  verifyPayment,
  type StockDashboard,
} from '@/lib/user-stock-api';
import { KpiCard, PeriodSelector } from '@/components/analytics/KpiCard';
import { useToast } from '@/components/ui/Toast';

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="text-white">Loading...</div>}>
      <DashboardPageInner />
    </Suspense>
  );
}

function DashboardPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refreshProfile } = useAuth();
  const { pages, loading: pagesLoading, connectFacebookPage, connectInstagramPage, disconnectPage } = usePages();
  const toast = useToast();
  const { t, dir } = useTranslation();
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState<string | null>(null);
  const [activePlatformTab, setActivePlatformTab] = useState('all');
  const [stockMode, setStockMode] = useState<'simple' | 'advanced'>('simple');
  const activeSection = searchParams.get('section') || 'overview';

  // Plans + billing
  const [availablePlans, setAvailablePlans] = useState<Array<{ id: string; slug: string; name: string; description: string | null; priceMonthly: string; priceYearly: string; currency: string; maxPages: number; maxProducts: number; maxConversations: number; features: string[]; isFeatured: boolean }>>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [subscribing, setSubscribing] = useState<string | null>(null);

  // Analytics state
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'today' | 'week' | 'month' | 'year'>('month');
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<StockDashboard | null>(null);
  const [salesStats, setSalesStats] = useState<{
    stats: { totalSales: number; totalRevenue: number; paidSales: number; pendingSales: number; averageOrderValue: number };
    topProducts: Array<{ productId: string; productName: string; _sum: { quantity: number; total: number } }>;
  } | null>(null);
  const [purchaseStats, setPurchaseStats] = useState<{
    stats: { totalPurchases: number; totalSpent: number; pendingPurchases: number; receivedPurchases: number };
    topSuppliers: Array<{ supplierId: string; _sum: { total: number } }>;
  } | null>(null);
  const [orderStats, setOrderStats] = useState<{
    stats: { totalOrders: number; totalRevenue: number; paidAmount: number; pending: number; confirmed: number; preparing: number; shipped: number; delivered: number; cancelled: number; averageOrderValue: number };
    topProducts: any[];
  } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('stockMode');
    if (saved === 'simple' || saved === 'advanced') setStockMode(saved);
  }, []);

  // Handle payment redirect — show toast ONCE, verify payment, then clean URL
  useEffect(() => {
    const payment = searchParams.get('payment');
    if (payment === 'success') {
      // Get checkout ID from URL or localStorage
      const checkoutId = searchParams.get('checkout_id') || localStorage.getItem('pending_checkout_id');
      localStorage.removeItem('pending_checkout_id');

      if (checkoutId) {
        toast.success('Payment received! Activating your plan...');
        verifyPayment(checkoutId)
          .then(async () => {
            toast.success('Plan upgraded successfully!');
            await refreshProfile();
            window.history.replaceState({}, '', '/dashboard?section=settings');
          })
          .catch(async () => {
            toast.info('Payment received. Plan will activate shortly.');
            await refreshProfile();
            window.history.replaceState({}, '', '/dashboard?section=settings');
          });
      } else {
        toast.success('Payment successful!');
        refreshProfile().catch(() => {});
        window.history.replaceState({}, '', '/dashboard?section=settings');
      }
    } else if (payment === 'failed') {
      localStorage.removeItem('pending_checkout_id');
      toast.error('Payment was cancelled or failed. Please try again.');
      window.history.replaceState({}, '', '/dashboard?section=settings');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      const period = analyticsPeriod === 'today' ? 'today' : analyticsPeriod;
      const purchasePeriod = analyticsPeriod === 'today' ? 'week' : analyticsPeriod;
      const [dashRes, salesRes, purchRes, orderRes] = await Promise.all([
        getStockDashboard(),
        getSalesStats(period as 'today' | 'week' | 'month' | 'year'),
        getPurchaseStats(purchasePeriod as 'week' | 'month' | 'year'),
        getOrderStats(period as 'today' | 'week' | 'month' | 'year'),
      ]);
      setDashboard(dashRes);
      setSalesStats(salesRes as any);
      setPurchaseStats(purchRes as any);
      setOrderStats(orderRes as any);
    } catch (err) {
      setAnalyticsError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'analytics' || activeSection === 'overview') {
      loadAnalytics();
    }
    if (activeSection === 'settings') {
      getPublicPlans().then((res) => setAvailablePlans(res.plans)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, analyticsPeriod]);

  const handleStockModeChange = (mode: 'simple' | 'advanced') => {
    setStockMode(mode);
    localStorage.setItem('stockMode', mode);
    window.dispatchEvent(new StorageEvent('storage', { key: 'stockMode', newValue: mode }));
  };

  const handleConnectFacebook = async () => {
    try {
      await connectFacebookPage();
    } catch (error) {
      console.error('Failed to connect Facebook:', error);
    }
  };

  const handleConnectInstagram = async () => {
    try {
      await connectInstagramPage();
    } catch (error) {
      console.error('Failed to connect Instagram:', error);
    }
  };

  const handleDisconnect = async (pageId: string) => {
    try {
      await disconnectPage(pageId);
      setShowDisconnectConfirm(null);
    } catch (error) {
      console.error('Failed to disconnect page:', error);
    }
  };

  const filteredPages = activePlatformTab === 'all'
    ? pages
    : pages.filter(page => page.platform === activePlatformTab);

  const getPlatformIcon = () => {
    return <FacebookIcon className="w-6 h-6 text-[#1877F2]" />;
  };

  return (
    <div dir={dir}>
      {/* Overview Section */}
      {activeSection === 'overview' && (
        <>
          {/* Header */}
          {(() => {
            const hour = new Date().getHours();
            const greeting = hour < 12 ? t('page.dash.greeting.morning') : hour < 18 ? t('page.dash.greeting.afternoon') : t('page.dash.greeting.evening');
            const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
            return (
              <div className="mb-8">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">{today}</p>
                <h1
                  className="text-3xl sm:text-4xl font-bold text-white mb-1"
                  style={{ fontFamily: 'Syne, sans-serif' }}
                >
                  {greeting}, {user?.firstName} <span className="text-zinc-600">·</span> <span className="text-zinc-400 font-normal">{t('page.dash.snapshot')}</span>
                </h1>
              </div>
            );
          })()}

          {/* KPI cards — uses the same neutral KpiCard as analytics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <KpiCard
              label={t('page.dash.connectedPages')}
              value={pages.length}
              hint={pages.length === 0 ? '' : `${pages.length}`}
              icon={<ChatIcon className="w-4 h-4" />}
              color="blue"
            />
            <KpiCard
              label={t('page.dash.products')}
              value={dashboard?.stats.totalProducts ?? '—'}
              hint={
                (dashboard?.stats.lowStockProducts ?? 0) > 0
                  ? `${dashboard?.stats.lowStockProducts} ${t('page.stock.lowStock').toLowerCase()}`
                  : ''
              }
              icon={<BoxIcon className="w-4 h-4" />}
              color="violet"
            />
            <KpiCard
              label={t('page.dash.revenue30d')}
              value={(() => {
                const s = Number(salesStats?.stats.totalRevenue || 0);
                const o = Number(orderStats?.stats.totalRevenue || 0);
                return `${(s + o).toLocaleString(undefined, { maximumFractionDigits: 0 })} DA`;
              })()}
              hint={`${(salesStats?.stats.totalSales ?? 0) + (orderStats?.stats.totalOrders ?? 0)}`}
              icon={<DollarIcon className="w-4 h-4" />}
              color="emerald"
            />
            <KpiCard
              label={t('page.dash.stockValue')}
              value={dashboard ? `${Number(dashboard.stats.totalStockValue).toLocaleString(undefined, { maximumFractionDigits: 0 })} DA` : '—'}
              hint=""
              icon={<PackageIcon className="w-4 h-4" />}
              color="orange"
            />
          </div>

          {/* Quick actions */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">{t('page.dash.quickActions')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <button
                onClick={() => router.push('/dashboard?section=pages')}
                className="group text-start bg-zinc-900/50 border border-white/10 hover:border-white/20 rounded-xl p-5 transition-all hover:bg-zinc-900/80"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                    <ChatIcon className="w-5 h-5" />
                  </div>
                  <span className="text-zinc-600 group-hover:text-white transition-colors">{dir === 'rtl' ? '←' : '→'}</span>
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">{t('page.dash.connectPage')}</h3>
                <p className="text-xs text-zinc-500">{t('page.dash.linkFb')}</p>
              </button>

              <button
                onClick={() => router.push('/dashboard/stock/products')}
                className="group text-start bg-zinc-900/50 border border-white/10 hover:border-white/20 rounded-xl p-5 transition-all hover:bg-zinc-900/80"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center">
                    <BoxIcon className="w-5 h-5" />
                  </div>
                  <span className="text-zinc-600 group-hover:text-white transition-colors">{dir === 'rtl' ? '←' : '→'}</span>
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">{t('page.dash.addProducts')}</h3>
                <p className="text-xs text-zinc-500">{t('page.dash.buildCatalog')}</p>
              </button>

              <button
                onClick={() => router.push('/dashboard/agents')}
                className="group text-start bg-zinc-900/50 border border-white/10 hover:border-white/20 rounded-xl p-5 transition-all hover:bg-zinc-900/80"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <SparklesIcon className="w-5 h-5" />
                  </div>
                  <span className="text-zinc-600 group-hover:text-white transition-colors">{dir === 'rtl' ? '←' : '→'}</span>
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">{t('page.dash.aiAgents')}</h3>
                <p className="text-xs text-zinc-500">{t('page.dash.manageAssistants')}</p>
              </button>
            </div>
          </div>

          {/* Two-column: Connected pages preview + Tips/Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Pages preview (2/3 width) */}
            <div className="lg:col-span-2 bg-zinc-900/50 border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">{t('page.dash.yourPages')}</h3>
                <button
                  onClick={() => router.push('/dashboard?section=pages')}
                  className="text-xs text-zinc-500 hover:text-white transition-colors"
                >
                  {t('page.dash.manageAll')}
                </button>
              </div>
              {pages.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                    <ChatIcon className="w-5 h-5 text-zinc-600" />
                  </div>
                  <p className="text-sm text-zinc-400 mb-1">{t('page.dash.noPages')}</p>
                  <p className="text-xs text-zinc-600 mb-4">Link a page to start receiving messages</p>
                  <Button size="sm" onClick={handleConnectFacebook} loading={pagesLoading} icon={<FacebookIcon className="w-4 h-4" />}>
                    Connect Facebook
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {pages.slice(0, 5).map((page) => (
                    <div
                      key={page.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => router.push(`/dashboard/page/${page.id}`)}
                    >
                      <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                        {getPlatformIcon()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{page.pageName}</p>
                        <p className="text-[11px] text-zinc-500 capitalize">{page.platform} · connected {new Date(page.createdAt).toLocaleDateString()}</p>
                      </div>
                      <Badge variant="success">Active</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tips / next steps (1/3 width) */}
            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white mb-4">Get Started</h3>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${pages.length > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-zinc-500'}`}>
                    {pages.length > 0 ? '✓' : '1'}
                  </div>
                  <div>
                    <p className={pages.length > 0 ? 'text-zinc-500 line-through' : 'text-white'}>Connect a page</p>
                    <p className="text-[11px] text-zinc-600">Link Facebook to start chatting</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${(dashboard?.stats.totalProducts ?? 0) > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-zinc-500'}`}>
                    {(dashboard?.stats.totalProducts ?? 0) > 0 ? '✓' : '2'}
                  </div>
                  <div>
                    <p className={(dashboard?.stats.totalProducts ?? 0) > 0 ? 'text-zinc-500 line-through' : 'text-white'}>Add products</p>
                    <p className="text-[11px] text-zinc-600">Build your catalog</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${pages.length > 0 && (dashboard?.stats.totalProducts ?? 0) > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-zinc-500'}`}>
                    {pages.length > 0 && (dashboard?.stats.totalProducts ?? 0) > 0 ? '✓' : '3'}
                  </div>
                  <div>
                    <p className={pages.length > 0 && (dashboard?.stats.totalProducts ?? 0) > 0 ? 'text-zinc-500 line-through' : 'text-white'}>Configure your AI agent</p>
                    <p className="text-[11px] text-zinc-600">Personalize tone and behavior</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${(salesStats?.stats.totalSales ?? 0) > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-zinc-500'}`}>
                    {(salesStats?.stats.totalSales ?? 0) > 0 ? '✓' : '4'}
                  </div>
                  <div>
                    <p className={(salesStats?.stats.totalSales ?? 0) > 0 ? 'text-zinc-500 line-through' : 'text-white'}>Make your first sale</p>
                    <p className="text-[11px] text-zinc-600">Watch the AI handle inquiries</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </>
      )}

      {/* Pages Section */}
      {activeSection === 'pages' && (
        <>
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
                  Social Media
                </h1>
                <p className="text-zinc-400">Manage all your connected social media pages and platforms</p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleConnectFacebook}
                  loading={pagesLoading}
                  icon={<FacebookIcon className="w-4 h-4" />}
                >
                  Connect Facebook
                </Button>
              </div>
            </div>
          </div>

          <Tabs defaultValue="all" value={activePlatformTab} onValueChange={setActivePlatformTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="all">All Platforms</TabsTrigger>
              <TabsTrigger value="facebook" icon={<FacebookIcon className="w-4 h-4" />}>Facebook</TabsTrigger>
            </TabsList>

            <TabsContent value={activePlatformTab}>
              {filteredPages.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPages.map((page) => (
                    <Card key={page.id} variant="interactive">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                            {getPlatformIcon()}
                          </div>
                          <div>
                            <h3 className="text-white font-semibold">{page.pageName}</h3>
                            <p className="text-xs text-zinc-500 capitalize">{page.platform}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 mb-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zinc-400">Status</span>
                          <Badge variant="success">Active</Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zinc-400">Connected</span>
                          <span className="text-white">{new Date(page.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zinc-400">AI Agent</span>
                          <Badge variant="success">Active</Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => router.push(`/dashboard/page/${page.id}`)}
                          icon={<SettingsIcon className="w-4 h-4" />}
                        >
                          Configure
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/dashboard/page/${page.id}/stock`)}
                          icon={<BoxIcon className="w-4 h-4" />}
                        >
                          Stock
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowDisconnectConfirm(page.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <CloseIcon className="w-4 h-4" />
                        </Button>
                      </div>

                      {showDisconnectConfirm === page.id && (
                        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                          <Card className="max-w-md mx-4">
                            <h3 className="text-xl font-bold text-white mb-2">Disconnect Page?</h3>
                            <p className="text-zinc-400 mb-6">
                              Are you sure you want to disconnect {page.pageName}? You won't receive messages anymore.
                            </p>
                            <div className="flex gap-3">
                              <Button variant="outline" className="flex-1" onClick={() => setShowDisconnectConfirm(null)}>Cancel</Button>
                              <Button variant="danger" className="flex-1" onClick={() => handleDisconnect(page.id)}>Disconnect</Button>
                            </div>
                          </Card>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <EmptyState
                    icon={<ChatIcon className="w-20 h-20" />}
                    title={activePlatformTab === 'all' ? 'No Pages Connected' : `No ${activePlatformTab.charAt(0).toUpperCase() + activePlatformTab.slice(1)} Pages`}
                    description={
                      activePlatformTab === 'all'
                        ? 'Connect your social media pages to start managing them with AI'
                        : `Connect your ${activePlatformTab.charAt(0).toUpperCase() + activePlatformTab.slice(1)} pages to get started`
                    }
                    action={
                      <Button onClick={handleConnectFacebook} loading={pagesLoading} icon={<FacebookIcon className="w-4 h-4" />}>
                        Connect Facebook
                      </Button>
                    }
                  />
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Analytics Section */}
      {activeSection === 'analytics' && (
        <>
          {/* Header with period selector */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>Analytics</h1>
              <p className="text-zinc-400">Performance overview for your business</p>
            </div>
            <div className="flex items-center gap-2">
              <PeriodSelector value={analyticsPeriod} onChange={setAnalyticsPeriod} />
              <button
                onClick={loadAnalytics}
                disabled={analyticsLoading}
                className="p-2 text-zinc-400 hover:text-white bg-zinc-900/60 border border-white/10 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshIcon className={`w-4 h-4 ${analyticsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {analyticsError && (
            <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
              {analyticsError}
            </div>
          )}

          {analyticsLoading && !salesStats ? (
            <div className="animate-pulse space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-zinc-900/60 rounded-xl" />)}
              </div>
              <div className="h-48 bg-zinc-900/60 rounded-xl" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-64 bg-zinc-900/60 rounded-xl" />
                <div className="h-64 bg-zinc-900/60 rounded-xl" />
              </div>
            </div>
          ) : (
            <>
              {/* KPI cards */}
              {(() => {
                // Combine Sales + Orders revenue
                const salesRevenue = Number(salesStats?.stats.totalRevenue || 0);
                const ordersRevenue = Number(orderStats?.stats.totalRevenue || 0);
                const revenue = salesRevenue + ordersRevenue;
                const spent = Number(purchaseStats?.stats.totalSpent || 0);
                const profit = revenue - spent;
                const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
                const salesCount = (salesStats?.stats.totalSales || 0);
                const ordersCount = (orderStats?.stats.totalOrders || 0);
                const totalCount = salesCount + ordersCount;
                const aov = totalCount > 0 ? revenue / totalCount : 0;
                const fmt = (n: number) => `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} DA`;
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <KpiCard
                      label="Revenue"
                      value={fmt(revenue)}
                      hint={`${totalCount} ${totalCount === 1 ? 'order' : 'orders'}`}
                      icon={<DollarIcon className="w-4 h-4 text-emerald-400" />}
                      color="emerald"
                    />
                    <KpiCard
                      label="Spent"
                      value={fmt(spent)}
                      hint={`${purchaseStats?.stats.totalPurchases || 0} purchases`}
                      icon={<ShoppingCartIcon className="w-4 h-4 text-orange-400" />}
                      color="orange"
                    />
                    <KpiCard
                      label="Profit"
                      value={`${profit >= 0 ? '+' : ''}${fmt(profit)}`}
                      hint={`${profitMargin.toFixed(1)}% margin`}
                      icon={profit >= 0 ? <ArrowUpIcon className="w-4 h-4 text-blue-400" /> : <ArrowDownIcon className="w-4 h-4 text-red-400" />}
                      color={profit >= 0 ? 'blue' : 'red'}
                    />
                    <KpiCard
                      label="Avg Order"
                      value={fmt(aov)}
                      hint="per sale"
                      icon={<ChartIcon className="w-4 h-4 text-violet-400" />}
                      color="violet"
                    />
                  </div>
                );
              })()}

              {/* Sales vs Spent comparison */}
              <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">Cash Flow</h3>
                  <span className="text-xs text-zinc-500">{analyticsPeriod === 'today' ? 'Today' : analyticsPeriod === 'week' ? 'Last 7 days' : analyticsPeriod === 'month' ? 'Last 30 days' : 'Last year'}</span>
                </div>
                {(() => {
                  const revenue = Number(salesStats?.stats.totalRevenue || 0) + Number(orderStats?.stats.totalRevenue || 0);
                  const spent = Number(purchaseStats?.stats.totalSpent || 0);
                  const max = Math.max(revenue, spent, 1);
                  return (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-emerald-400 font-medium">Income</span>
                          <span className="text-white font-medium">{revenue.toLocaleString()} DA</span>
                        </div>
                        <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                            style={{ width: `${(revenue / max) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-orange-400 font-medium">Outflow</span>
                          <span className="text-white font-medium">{spent.toLocaleString()} DA</span>
                        </div>
                        <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all duration-500"
                            style={{ width: `${(spent / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Two column layout: Top Products + Inventory */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Top Products */}
                <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white">Top Selling Products</h3>
                    <PackageIcon className="w-4 h-4 text-zinc-500" />
                  </div>
                  {(() => {
                    const topProds = (salesStats?.topProducts?.length ? salesStats.topProducts : orderStats?.topProducts) || [];
                    return topProds.length > 0 ? true : false;
                  })() ? (
                    <div className="space-y-3">
                      {((salesStats?.topProducts?.length ? salesStats.topProducts : orderStats?.topProducts) || []).slice(0, 5).map((p: any, i: number) => {
                        const allProds = (salesStats?.topProducts?.length ? salesStats.topProducts : orderStats?.topProducts) || [];
                        const max = Number(allProds[0]?._sum?.total) || 1;
                        const value = Number(p._sum.total) || 0;
                        const pct = (value / max) * 100;
                        return (
                          <div key={p.productId || i}>
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`flex-shrink-0 w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${
                                  i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                                  i === 1 ? 'bg-zinc-400/20 text-zinc-300' :
                                  i === 2 ? 'bg-orange-700/20 text-orange-400' :
                                  'bg-white/5 text-zinc-500'
                                }`}>{i + 1}</span>
                                <span className="text-zinc-300 truncate">{p.productName}</span>
                              </div>
                              <span className="text-white font-medium flex-shrink-0 ml-2">{value.toLocaleString()} DA</span>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-500/60 to-emerald-400 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-zinc-600 mt-0.5">{p._sum.quantity || 0} units sold</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <BoxIcon className="w-10 h-10 text-zinc-700 mx-auto mb-2" />
                      <p className="text-xs text-zinc-500">No sales in this period</p>
                    </div>
                  )}
                </div>

                {/* Inventory health */}
                <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white">Inventory Health</h3>
                    <BoxIcon className="w-4 h-4 text-zinc-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Products</p>
                      <p className="text-xl font-bold text-white">{dashboard?.stats.totalProducts || 0}</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Categories</p>
                      <p className="text-xl font-bold text-white">{dashboard?.stats.totalCategories || 0}</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Stock Value</p>
                      <p className="text-xl font-bold text-white">
                        {Number(dashboard?.stats.totalStockValue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        <span className="text-xs text-zinc-500 ml-1">DA</span>
                      </p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Retail Value</p>
                      <p className="text-xl font-bold text-emerald-400">
                        {Number(dashboard?.stats.totalRetailValue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        <span className="text-xs text-zinc-500 ml-1">DA</span>
                      </p>
                    </div>
                  </div>
                  {(dashboard?.stats.lowStockProducts || 0) > 0 ? (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                        <AlertIcon className="w-4 h-4 text-yellow-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-yellow-400">{dashboard?.stats.lowStockProducts} products low on stock</p>
                        <p className="text-xs text-yellow-400/60">Restock soon to avoid shortages</p>
                      </div>
                      <button
                        onClick={() => router.push('/dashboard/stock/products?lowStock=true')}
                        className="text-xs text-yellow-400 hover:text-yellow-300 font-medium whitespace-nowrap"
                      >
                        View →
                      </button>
                    </div>
                  ) : (
                    <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                        <BoxIcon className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-emerald-400">All stock levels healthy</p>
                        <p className="text-xs text-emerald-400/60">No products need restocking</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Order status breakdown */}
              <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">Orders Status</h3>
                  <span className="text-xs text-zinc-500">{(salesStats?.stats.totalSales || 0) + (orderStats?.stats.totalOrders || 0)} total</span>
                </div>
                {(() => {
                  const paid = (salesStats?.stats.paidSales || 0) + (orderStats?.stats.delivered || 0);
                  const pending = (salesStats?.stats.pendingSales || 0) + (orderStats?.stats.pending || 0) + (orderStats?.stats.confirmed || 0) + (orderStats?.stats.preparing || 0) + (orderStats?.stats.shipped || 0);
                  const total = paid + pending || 1;
                  const paidPct = (paid / total) * 100;
                  const pendingPct = (pending / total) * 100;
                  return (
                    <>
                      <div className="h-3 bg-white/5 rounded-full overflow-hidden flex mb-3">
                        {paidPct > 0 && (
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                            style={{ width: `${paidPct}%` }}
                          />
                        )}
                        {pendingPct > 0 && (
                          <div
                            className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 transition-all duration-500"
                            style={{ width: `${pendingPct}%` }}
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-6 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="text-zinc-400">Paid</span>
                          <span className="text-white font-medium">{paid}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-yellow-400" />
                          <span className="text-zinc-400">Pending</span>
                          <span className="text-white font-medium">{pending}</span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Connected pages summary */}
              <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">Connected Channels</h3>
                  <span className="text-xs text-zinc-500">{pages.length} {pages.length === 1 ? 'page' : 'pages'}</span>
                </div>
                {pages.length === 0 ? (
                  <div className="text-center py-6">
                    <ChatIcon className="w-10 h-10 text-zinc-700 mx-auto mb-2" />
                    <p className="text-xs text-zinc-500 mb-3">No pages connected yet</p>
                    <Button size="sm" variant="outline" onClick={() => router.push('/dashboard?section=overview')}>
                      Connect a page
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(['facebook'] as const).map((platform) => {
                      const count = pages.filter(p => p.platform === platform).length;
                      const Icon = FacebookIcon;
                      const color = '#1877F2';
                      return (
                        <div key={platform} className="bg-white/[0.02] border border-white/5 rounded-lg p-4 flex items-center gap-3">
                          <span style={{ color }}>
                            <Icon className="w-6 h-6" />
                          </span>
                          <div>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{platform}</p>
                            <p className="text-lg font-bold text-white">{count}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Settings Section */}
      {activeSection === 'settings' && (
        <>
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>Settings</h1>
            <p className="text-zinc-400">Manage your account and application settings</p>
          </div>

          <div className="space-y-6">
            {/* Stock Management Mode */}
            <div>
              <h2 className="text-xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>Stock Management</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => handleStockModeChange('simple')}
                  className={`text-left p-5 rounded-xl border-2 transition-all ${
                    stockMode === 'simple'
                      ? 'border-white bg-white/5'
                      : 'border-white/10 bg-zinc-900/50 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      stockMode === 'simple' ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      <BoxIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">Simple</h3>
                      {stockMode === 'simple' && (
                        <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">Active</span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Products, Categories & Orders — manage your inventory and orders without the complexity.
                  </p>
                </button>
                <button
                  onClick={() => handleStockModeChange('advanced')}
                  className={`text-left p-5 rounded-xl border-2 transition-all ${
                    stockMode === 'advanced'
                      ? 'border-white bg-white/5'
                      : 'border-white/10 bg-zinc-900/50 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      stockMode === 'advanced' ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      <BoltIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">Advanced</h3>
                      {stockMode === 'advanced' && (
                        <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">Active</span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Full suite — Suppliers, Clients, Sales, Purchases, Caisse, Movements, Delivery & more.
                  </p>
                </button>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>Account Information</h2>
              <Card>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input label="First Name" value={user?.firstName || ''} disabled />
                  <Input label="Last Name" value={user?.lastName || ''} disabled />
                  <div className="md:col-span-2">
                    <Input label="Email" type="email" value={user?.email || ''} disabled />
                  </div>
                </div>
              </Card>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>Plan & Billing</h2>
                <div className="inline-flex items-center bg-zinc-900/60 border border-white/10 rounded-lg p-1">
                  <button
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${billingCycle === 'monthly' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingCycle('yearly')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${billingCycle === 'yearly' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
                  >
                    Yearly
                  </button>
                </div>
              </div>

              {/* Current plan badge */}
              <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4 mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-0.5">Current plan</p>
                  <p className="text-white font-semibold capitalize">{user?.plan || 'Free'}</p>
                </div>
                <Badge variant="info" size="md">{user?.plan || 'Free'}</Badge>
              </div>

              {/* Plan cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {availablePlans.map((plan) => {
                  const price = billingCycle === 'yearly' ? Number(plan.priceYearly) : Number(plan.priceMonthly);
                  const isCurrent = user?.plan === plan.slug;
                  const isFree = price === 0;

                  return (
                    <div
                      key={plan.id}
                      className={`bg-zinc-900/50 border rounded-xl p-5 flex flex-col transition-colors ${
                        plan.isFeatured ? 'border-white/30' : 'border-white/10'
                      } ${isCurrent ? 'ring-1 ring-emerald-500/30' : ''}`}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-semibold text-white">{plan.name}</h3>
                        {isCurrent && <Badge variant="success" size="sm">Current</Badge>}
                        {plan.isFeatured && !isCurrent && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-medium uppercase tracking-wider">Popular</span>
                        )}
                      </div>

                      {/* Price */}
                      <div className="mb-3">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                            {isFree ? 'Free' : price.toLocaleString()}
                          </span>
                          {!isFree && (
                            <span className="text-sm text-zinc-500">{plan.currency}/{billingCycle === 'yearly' ? 'yr' : 'mo'}</span>
                          )}
                        </div>
                        {plan.description && <p className="text-xs text-zinc-500 mt-1">{plan.description}</p>}
                      </div>

                      {/* Features */}
                      <ul className="space-y-1.5 mb-5 flex-1">
                        {(plan.features || []).slice(0, 6).map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                            <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            {f}
                          </li>
                        ))}
                      </ul>

                      {/* Action */}
                      {isCurrent ? (
                        <div className="px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-center text-xs font-medium text-emerald-400">
                          Your current plan
                        </div>
                      ) : isFree ? (
                        <div className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-center text-xs font-medium text-zinc-400">
                          Free — no payment needed
                        </div>
                      ) : (
                        <button
                          onClick={async () => {
                            try {
                              setSubscribing(plan.slug);
                              const res = await createCheckout(plan.slug, billingCycle);
                              if (res.checkoutUrl) {
                                // Store checkout ID for verification after payment
                                if (res.checkoutId) {
                                  localStorage.setItem('pending_checkout_id', res.checkoutId);
                                }
                                window.location.href = res.checkoutUrl;
                              }
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : 'Failed to start checkout');
                            } finally {
                              setSubscribing(null);
                            }
                          }}
                          disabled={subscribing === plan.slug}
                          className="w-full px-4 py-2.5 bg-white text-black rounded-lg text-sm font-semibold hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {subscribing === plan.slug ? 'Redirecting…' : `Subscribe — ${price.toLocaleString()} ${plan.currency}`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {availablePlans.length === 0 && (
                <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-8 text-center text-sm text-zinc-500">
                  No plans available yet. Ask your admin to create plans.
                </div>
              )}
            </div>

            <div>
              <h2 className="text-xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>Facebook API Permissions</h2>
              <Card>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-white font-semibold mb-2">Currently Active Permissions</h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="success">pages_show_list</Badge>
                      <Badge variant="success">pages_manage_metadata</Badge>
                      <Badge variant="success">pages_messaging</Badge>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-white/10">
                    <h3 className="text-white font-semibold mb-2">Available Advanced Permissions</h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge variant="info">pages_read_engagement</Badge>
                      <Badge variant="info">pages_read_user_content</Badge>
                      <Badge variant="info">pages_manage_posts</Badge>
                      <Badge variant="info">pages_manage_engagement</Badge>
                      <Badge variant="info">read_insights</Badge>
                    </div>
                    <p className="text-sm text-zinc-400">These permissions require Facebook App Review approval.</p>
                  </div>
                </div>
              </Card>
            </div>

            <div>
              <h2 className="text-xl font-bold text-red-400 mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>Danger Zone</h2>
              <Card className="border-red-500/20 bg-red-500/5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="text-red-400 font-semibold mb-1">Delete Account</h3>
                    <p className="text-red-300/80 text-sm">Permanently delete your account and all associated data.</p>
                  </div>
                  <Button variant="danger">Delete Account</Button>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
