'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePages } from '@/contexts/PagesContext';
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
  InstagramIcon,
  WhatsAppIcon,
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
  type StockDashboard,
} from '@/lib/user-stock-api';
import { KpiCard, PeriodSelector } from '@/components/analytics/KpiCard';

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
  const { user } = useAuth();
  const { pages, loading: pagesLoading, connectFacebookPage, connectInstagramPage, disconnectPage } = usePages();
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState<string | null>(null);
  const [activePlatformTab, setActivePlatformTab] = useState('all');
  const [stockMode, setStockMode] = useState<'simple' | 'advanced'>('simple');
  const activeSection = searchParams.get('section') || 'overview';

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

  useEffect(() => {
    const saved = localStorage.getItem('stockMode');
    if (saved === 'simple' || saved === 'advanced') setStockMode(saved);
  }, []);

  const loadAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      const period = analyticsPeriod === 'today' ? 'today' : analyticsPeriod;
      const purchasePeriod = analyticsPeriod === 'today' ? 'week' : analyticsPeriod;
      const [dashRes, salesRes, purchRes] = await Promise.all([
        getStockDashboard(),
        getSalesStats(period as 'today' | 'week' | 'month' | 'year'),
        getPurchaseStats(purchasePeriod as 'week' | 'month' | 'year'),
      ]);
      setDashboard(dashRes);
      setSalesStats(salesRes as any);
      setPurchaseStats(purchRes as any);
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

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'facebook':
        return <FacebookIcon className="w-6 h-6 text-[#1877F2]" />;
      case 'instagram':
        return <InstagramIcon className="w-6 h-6 text-[#E4405F]" />;
      case 'whatsapp':
        return <WhatsAppIcon className="w-6 h-6 text-[#25D366]" />;
      default:
        return <ChatIcon className="w-6 h-6" />;
    }
  };

  return (
    <>
      {/* Overview Section */}
      {activeSection === 'overview' && (
        <>
          {/* Header */}
          {(() => {
            const hour = new Date().getHours();
            const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
            const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
            return (
              <div className="mb-8">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">{today}</p>
                <h1
                  className="text-3xl sm:text-4xl font-bold text-white mb-1"
                  style={{ fontFamily: 'Syne, sans-serif' }}
                >
                  {greeting}, {user?.firstName} <span className="text-zinc-600">·</span> <span className="text-zinc-400 font-normal">here&apos;s a snapshot</span>
                </h1>
              </div>
            );
          })()}

          {/* KPI cards — uses the same neutral KpiCard as analytics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <KpiCard
              label="Connected Pages"
              value={pages.length}
              hint={pages.length === 0 ? 'Connect to start' : `${pages.length} active`}
              icon={<ChatIcon className="w-4 h-4" />}
              color="blue"
            />
            <KpiCard
              label="Products"
              value={dashboard?.stats.totalProducts ?? '—'}
              hint={
                (dashboard?.stats.lowStockProducts ?? 0) > 0
                  ? `${dashboard?.stats.lowStockProducts} low stock`
                  : 'In catalog'
              }
              icon={<BoxIcon className="w-4 h-4" />}
              color="violet"
            />
            <KpiCard
              label="Sales (30d)"
              value={salesStats ? `${Number(salesStats.stats.totalRevenue).toLocaleString(undefined, { maximumFractionDigits: 0 })} DA` : '—'}
              hint={`${salesStats?.stats.totalSales ?? 0} orders`}
              icon={<DollarIcon className="w-4 h-4" />}
              color="emerald"
            />
            <KpiCard
              label="Stock Value"
              value={dashboard ? `${Number(dashboard.stats.totalStockValue).toLocaleString(undefined, { maximumFractionDigits: 0 })} DA` : '—'}
              hint="At cost"
              icon={<PackageIcon className="w-4 h-4" />}
              color="orange"
            />
          </div>

          {/* Quick actions */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <button
                onClick={() => router.push('/dashboard?section=pages')}
                className="group text-left bg-zinc-900/50 border border-white/10 hover:border-white/20 rounded-xl p-5 transition-all hover:bg-zinc-900/80"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                    <ChatIcon className="w-5 h-5" />
                  </div>
                  <span className="text-zinc-600 group-hover:text-white transition-colors">→</span>
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">Connect a Page</h3>
                <p className="text-xs text-zinc-500">Link Facebook, Instagram or WhatsApp</p>
              </button>

              <button
                onClick={() => router.push('/dashboard/stock/products')}
                className="group text-left bg-zinc-900/50 border border-white/10 hover:border-white/20 rounded-xl p-5 transition-all hover:bg-zinc-900/80"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center">
                    <BoxIcon className="w-5 h-5" />
                  </div>
                  <span className="text-zinc-600 group-hover:text-white transition-colors">→</span>
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">Add Products</h3>
                <p className="text-xs text-zinc-500">Build your catalog</p>
              </button>

              <button
                onClick={() => router.push('/dashboard/agents')}
                className="group text-left bg-zinc-900/50 border border-white/10 hover:border-white/20 rounded-xl p-5 transition-all hover:bg-zinc-900/80"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <SparklesIcon className="w-5 h-5" />
                  </div>
                  <span className="text-zinc-600 group-hover:text-white transition-colors">→</span>
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">AI Agents</h3>
                <p className="text-xs text-zinc-500">Manage your assistants</p>
              </button>
            </div>
          </div>

          {/* Two-column: Connected pages preview + Tips/Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Pages preview (2/3 width) */}
            <div className="lg:col-span-2 bg-zinc-900/50 border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Your Pages</h3>
                <button
                  onClick={() => router.push('/dashboard?section=pages')}
                  className="text-xs text-zinc-500 hover:text-white transition-colors"
                >
                  Manage all →
                </button>
              </div>
              {pages.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                    <ChatIcon className="w-5 h-5 text-zinc-600" />
                  </div>
                  <p className="text-sm text-zinc-400 mb-1">No pages connected yet</p>
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
                        {getPlatformIcon(page.platform)}
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
                  <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold bg-white/5 text-zinc-500">3</div>
                  <div>
                    <p className="text-white">Configure your AI agent</p>
                    <p className="text-[11px] text-zinc-600">Personalize tone and behavior</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold bg-white/5 text-zinc-500">4</div>
                  <div>
                    <p className="text-white">Make your first sale</p>
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
                <Button
                  disabled
                  className="opacity-50 cursor-not-allowed"
                  variant="outline"
                  icon={<InstagramIcon className="w-4 h-4" />}
                >
                  Instagram (Coming Soon)
                </Button>
              </div>
            </div>
          </div>

          <Tabs defaultValue="all" value={activePlatformTab} onValueChange={setActivePlatformTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="all">All Platforms</TabsTrigger>
              <TabsTrigger value="facebook" icon={<FacebookIcon className="w-4 h-4" />}>Facebook</TabsTrigger>
              <TabsTrigger value="instagram" icon={<InstagramIcon className="w-4 h-4" />} disabled className="opacity-50 cursor-not-allowed">Instagram (Soon)</TabsTrigger>
              <TabsTrigger value="whatsapp" icon={<WhatsAppIcon className="w-4 h-4" />} disabled className="opacity-50 cursor-not-allowed">WhatsApp (Soon)</TabsTrigger>
            </TabsList>

            <TabsContent value={activePlatformTab}>
              {filteredPages.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPages.map((page) => (
                    <Card key={page.id} variant="interactive">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                            {getPlatformIcon(page.platform)}
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
                const revenue = Number(salesStats?.stats.totalRevenue || 0);
                const spent = Number(purchaseStats?.stats.totalSpent || 0);
                const profit = revenue - spent;
                const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
                const aov = Number(salesStats?.stats.averageOrderValue || 0);
                const orders = salesStats?.stats.totalSales || 0;
                const fmt = (n: number) => `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} DA`;
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <KpiCard
                      label="Revenue"
                      value={fmt(revenue)}
                      hint={`${orders} ${orders === 1 ? 'sale' : 'sales'}`}
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
                  const revenue = Number(salesStats?.stats.totalRevenue || 0);
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
                  {salesStats?.topProducts && salesStats.topProducts.length > 0 ? (
                    <div className="space-y-3">
                      {salesStats.topProducts.slice(0, 5).map((p, i) => {
                        const max = Number(salesStats.topProducts[0]._sum.total) || 1;
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
                  <h3 className="text-sm font-semibold text-white">Sales Status</h3>
                  <span className="text-xs text-zinc-500">{salesStats?.stats.totalSales || 0} total</span>
                </div>
                {(() => {
                  const paid = salesStats?.stats.paidSales || 0;
                  const pending = salesStats?.stats.pendingSales || 0;
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
                    {(['facebook', 'instagram', 'whatsapp'] as const).map((platform) => {
                      const count = pages.filter(p => p.platform === platform).length;
                      const Icon = platform === 'facebook' ? FacebookIcon : platform === 'instagram' ? InstagramIcon : WhatsAppIcon;
                      const color = platform === 'facebook' ? '#1877F2' : platform === 'instagram' ? '#E4405F' : '#25D366';
                      return (
                        <div key={platform} className="bg-white/[0.02] border border-white/5 rounded-lg p-4 flex items-center gap-3">
                          <Icon className="w-6 h-6" style={{ color }} />
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
              <h2 className="text-xl font-bold text-white mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>Plan & Billing</h2>
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-white font-semibold mb-1">Current Plan</p>
                    <p className="text-zinc-400 text-sm">You are on the <span className="text-white capitalize">{user?.plan || 'Free'}</span> plan</p>
                  </div>
                  <Badge variant="info" size="md">{user?.plan || 'Free'}</Badge>
                </div>
                <div className="pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-zinc-400 text-sm">Pages Limit</span>
                    <span className="text-white text-sm">{pages.length} / 10</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-2 mb-4">
                    <div className="bg-white h-2 rounded-full transition-all" style={{ width: `${(pages.length / 10) * 100}%` }} />
                  </div>
                  <Button className="w-full">Upgrade Plan</Button>
                </div>
              </Card>
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
    </>
  );
}
