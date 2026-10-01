'use client';

import { useEffect, useState } from 'react';
import {
  DollarIcon,
  UsersIcon,
  BoxIcon,
  ChatIcon,
  ChartIcon,
  ShoppingCartIcon,
  RefreshIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  FacebookIcon,
} from '@/components/ui/icons';
import { getAdminAnalytics, type AdminAnalytics } from '@/lib/admin-api';
import { KpiCard, PeriodSelector } from '@/components/analytics/KpiCard';
import { useTranslation } from '@/contexts/LanguageContext';

type Period = 'today' | 'week' | 'month' | 'year';

export default function AdminAnalyticsPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAdminAnalytics(period);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('adm.plat.an.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const periodLabel = t(`adm.plat.an.period.${period}`);

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>{t('adm.plat.an.title')}</h1>
          <p className="text-sm text-zinc-400">{t('adm.plat.an.subtitle')} · {periodLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector value={period} onChange={setPeriod} />
          <button
            onClick={load}
            disabled={loading}
            className="p-2 text-zinc-400 hover:text-white bg-zinc-900/60 border border-white/10 rounded-lg transition-colors disabled:opacity-50"
            title={t('adm.plat.refresh')}
            aria-label={t('adm.plat.refresh')}
          >
            <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <div key={i} className="h-28 bg-zinc-900/60 rounded-xl" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-zinc-900/60 rounded-xl" />
            <div className="h-64 bg-zinc-900/60 rounded-xl" />
          </div>
        </div>
      ) : data ? (
        <>
          {/* Top KPI row — Users + Revenue + Profit + Engagement */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard
              label={t('adm.plat.an.kpi.totalUsers')}
              value={data.stats.totalUsers.toLocaleString()}
              hint={t('adm.plat.an.kpi.newUsers').replace('{n}', String(data.stats.newUsersInPeriod))}
              icon={<UsersIcon className="w-4 h-4 text-violet-400" />}
              color="violet"
            />
            <KpiCard
              label={t('adm.plat.an.kpi.revenue')}
              value={`${formatNumber(data.stats.totalRevenue)} DA`}
              hint={t('adm.plat.an.kpi.sales').replace('{n}', String(data.stats.totalSales))}
              icon={<DollarIcon className="w-4 h-4 text-emerald-400" />}
              color="emerald"
            />
            <KpiCard
              label={t('adm.plat.an.kpi.spent')}
              value={`${formatNumber(data.stats.totalSpent)} DA`}
              hint={t('adm.plat.an.kpi.purchases').replace('{n}', String(data.stats.totalPurchases))}
              icon={<ShoppingCartIcon className="w-4 h-4 text-orange-400" />}
              color="orange"
            />
            <KpiCard
              label={t('adm.plat.an.kpi.profit')}
              value={`${data.stats.totalRevenue - data.stats.totalSpent >= 0 ? '+' : ''}${formatNumber(data.stats.totalRevenue - data.stats.totalSpent)} DA`}
              hint={t('adm.plat.an.kpi.margin').replace('{n}', data.stats.totalRevenue > 0 ? (((data.stats.totalRevenue - data.stats.totalSpent) / data.stats.totalRevenue) * 100).toFixed(1) : '0')}
              icon={data.stats.totalRevenue - data.stats.totalSpent >= 0 ? <ArrowUpIcon className="w-4 h-4 text-blue-400" /> : <ArrowDownIcon className="w-4 h-4 text-red-400" />}
              color={data.stats.totalRevenue - data.stats.totalSpent >= 0 ? 'blue' : 'red'}
            />
          </div>

          {/* Second KPI row — Catalog + Channels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard
              label={t('adm.plat.an.kpi.products')}
              value={data.stats.totalProducts.toLocaleString()}
              hint={t('adm.plat.an.kpi.productsHint')}
              icon={<BoxIcon className="w-4 h-4 text-zinc-300" />}
              color="zinc"
            />
            <KpiCard
              label={t('adm.plat.an.kpi.pages')}
              value={data.stats.totalPages.toLocaleString()}
              hint={t('adm.plat.an.kpi.pagesHint')}
              icon={<ChatIcon className="w-4 h-4 text-zinc-300" />}
              color="zinc"
            />
            <KpiCard
              label={t('adm.plat.an.kpi.agents')}
              value={data.stats.activeAgents.toLocaleString()}
              hint={t('adm.plat.an.kpi.agentsHint')}
              icon={<ChartIcon className="w-4 h-4 text-zinc-300" />}
              color="zinc"
            />
            <KpiCard
              label={t('adm.plat.an.kpi.messages')}
              value={data.stats.messagesInPeriod.toLocaleString()}
              hint={periodLabel.toLowerCase()}
              icon={<ChatIcon className="w-4 h-4 text-zinc-300" />}
              color="zinc"
            />
          </div>

          {/* Two-column: Channels + Plans */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Channels by platform */}
            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white mb-4">{t('adm.plat.an.pagesByPlatform')}</h3>
              <div className="space-y-3">
                {(['facebook'] as const).map((platform) => {
                  const found = data.pagesByPlatform.find(p => p.platform === platform);
                  const count = found?.count || 0;
                  const total = data.pagesByPlatform.reduce((s, p) => s + p.count, 0) || 1;
                  const pct = (count / total) * 100;
                  const Icon = FacebookIcon;
                  const color = '#1877F2';
                  return (
                    <div key={platform}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2">
                          <span style={{ color }}>
                            <Icon className="w-4 h-4" />
                          </span>
                          <span className="text-zinc-300 capitalize">{platform}</span>
                        </div>
                        <span className="text-white font-medium">{count}</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Plans */}
            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white mb-4">{t('adm.plat.an.usersByPlan')}</h3>
              <div className="space-y-3">
                {data.planBreakdown.length === 0 ? (
                  <p className="text-xs text-zinc-500">{t('adm.plat.an.noData')}</p>
                ) : (
                  data.planBreakdown.map((p) => {
                    const total = data.planBreakdown.reduce((s, x) => s + x.count, 0) || 1;
                    const pct = (p.count / total) * 100;
                    return (
                      <div key={p.plan}>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-zinc-300 capitalize">{p.plan}</span>
                          <span className="text-white font-medium">{p.count} <span className="text-zinc-500">({pct.toFixed(0)}%)</span></span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-white rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Recent signups */}
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">{t('adm.plat.an.recentSignups')}</h3>
              <span className="text-xs text-zinc-500">{t('adm.plat.an.totalAdmins').replace('{total}', String(data.stats.totalUsers)).replace('{admins}', String(data.stats.adminCount))}</span>
            </div>
            {data.recentSignups.length === 0 ? (
              <p className="text-xs text-zinc-500 py-4 text-center">{t('adm.plat.an.noSignups')}</p>
            ) : (
              <div className="space-y-2">
                {data.recentSignups.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-xs font-semibold text-zinc-300 flex-shrink-0">
                      {u.firstName?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{u.firstName} {u.lastName}</p>
                      <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 text-zinc-400">{u.plan}</span>
                    <span className="text-[10px] text-zinc-600 hidden sm:inline">{new Date(u.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </>
  );
}

function formatNumber(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
