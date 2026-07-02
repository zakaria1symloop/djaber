'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePageConfig } from '@/contexts/PageConfigContext';
import { BoxIcon, PackageIcon, ChevronRightIcon, SearchIcon } from '@/components/ui/icons';
import { getStockDashboard } from '@/lib/user-stock-api';
import { useTranslation } from '@/contexts/LanguageContext';

interface Page {
  id: string;
  pageName: string;
  platform: string;
}

interface OverviewSectionProps {
  pageId: string;
  page: Page;
}

export default function OverviewSection({ pageId }: OverviewSectionProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const { insights, loading, error, fetchInsights, clearError } = usePageConfig();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [mainStock, setMainStock] = useState<{ totalProducts: number; totalStockValue: number } | null>(null);

  useEffect(() => {
    getStockDashboard()
      .then((d) => setMainStock({ totalProducts: d.stats.totalProducts, totalStockValue: d.stats.totalStockValue }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadInsights();
  }, [pageId]);

  const loadInsights = async () => {
    try {
      await fetchInsights(pageId);
      setLastUpdated(new Date());
    } catch (err) {
      // Error is handled by context
    }
  };

  const getMetricValue = (metricName: string): number => {
    if (!insights?.data) return 0;
    const metric = insights.data.find((m) => m.name === metricName);
    if (!metric || !metric.values || metric.values.length === 0) return 0;
    return metric.values[metric.values.length - 1]?.value || 0;
  };

  const metrics = [
    {
      name: t('overview.metric.followers'),
      value: getMetricValue('page_followers_count'),
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      color: 'blue',
    },
    {
      name: t('overview.metric.impressions'),
      value: getMetricValue('page_impressions'),
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      color: 'purple',
    },
    {
      name: t('overview.metric.engagedUsers'),
      value: getMetricValue('page_engaged_users'),
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
        </svg>
      ),
      color: 'green',
    },
    {
      name: t('overview.metric.postEngagements'),
      value: getMetricValue('page_post_engagements'),
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      ),
      color: 'yellow',
    },
  ];

  const colorClasses = {
    blue: 'bg-white/5',
    purple: 'bg-white/5',
    green: 'bg-white/5',
    yellow: 'bg-white/5',
  };

  if (loading && !insights) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
            {t('overview.title')}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[#0a0a0a] border border-white/10 rounded-xl p-6 animate-pulse">
              <div className="h-12 w-12 bg-white/10 rounded-lg mb-4"></div>
              <div className="h-4 bg-white/10 rounded w-20 mb-2"></div>
              <div className="h-8 bg-white/10 rounded w-24"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
            {t('overview.title')}
          </h2>
          {lastUpdated && (
            <p className="text-sm text-zinc-500 mt-1">
              {t('overview.lastUpdated').replace('{time}', lastUpdated.toLocaleTimeString())}
            </p>
          )}
        </div>
        <button
          onClick={loadInsights}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white text-sm transition-all disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {t('overview.refresh')}
        </button>
      </div>

      {/* Metrics Grid — only show if we have real data */}
      {metrics.some((m) => m.value > 0) && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <div
            key={metric.name}
            className="bg-zinc-900/50 border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all"
          >
            <div className={`w-12 h-12 rounded-lg ${colorClasses[metric.color as keyof typeof colorClasses]} flex items-center justify-center mb-4`}>
              <div className="text-zinc-300">{metric.icon}</div>
            </div>
            <p className="text-zinc-400 text-sm mb-1">{metric.name}</p>
            <p className="text-white text-3xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
              {metric.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>
      )}

      {/* AI page analysis CTA */}
      <div className="bg-zinc-900/40 border border-white/10 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-zinc-300 flex items-center justify-center flex-shrink-0">
              <SearchIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">{t('overview.aiAnalyze.title')}</h3>
              <p className="text-xs text-zinc-400 max-w-md">{t('overview.aiAnalyze.desc')}</p>
            </div>
          </div>
          <button
            onClick={() => router.push(`/dashboard/page/${pageId}/analyze`)}
            className="px-4 py-2 bg-white hover:bg-zinc-200 text-black rounded-lg text-xs font-semibold whitespace-nowrap"
          >
            {t('overview.aiAnalyze.cta')}
          </button>
        </div>
      </div>

      {/* Stock & Inventory link card */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-white/5 text-zinc-300 flex items-center justify-center">
            <BoxIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{t('overview.stock.title')}</h3>
            <p className="text-[11px] text-zinc-500">{t('overview.stock.subtitle')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Main stock (user-level) */}
          <button
            onClick={() => router.push('/dashboard/stock/products')}
            className="group text-left bg-white/[0.02] border border-white/10 hover:border-white/20 hover:bg-white/[0.04] rounded-xl p-4 transition-all"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <PackageIcon className="w-4 h-4 text-zinc-500" />
                <span className="text-xs font-medium text-white">{t('overview.stock.main')}</span>
              </div>
              <ChevronRightIcon className="w-4 h-4 text-zinc-600 group-hover:text-white transition-colors" />
            </div>
            <p className="text-[11px] text-zinc-500 mb-2">{t('overview.stock.mainDesc')}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-white">{mainStock?.totalProducts ?? '—'}</span>
              <span className="text-[11px] text-zinc-500">{t('overview.stock.mainCount')}</span>
            </div>
          </button>

          {/* Page-specific stock */}
          <button
            onClick={() => router.push(`/dashboard/page/${pageId}/stock`)}
            className="group text-left bg-white/[0.02] border border-white/10 hover:border-white/20 hover:bg-white/[0.04] rounded-xl p-4 transition-all"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <BoxIcon className="w-4 h-4 text-zinc-500" />
                <span className="text-xs font-medium text-white">{t('overview.stock.page')}</span>
              </div>
              <ChevronRightIcon className="w-4 h-4 text-zinc-600 group-hover:text-white transition-colors" />
            </div>
            <p className="text-[11px] text-zinc-500 mb-2">{t('overview.stock.pageDesc')}</p>
            <div className="text-[11px] text-zinc-400">{t('overview.stock.pageCta')}</div>
          </button>
        </div>
      </div>

      {/* Info Box - Show when insights are not available (expected behavior) */}
      {(!insights || insights.data.length === 0 || error) && (
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-zinc-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="text-white font-medium">{t('overview.insights.unavail.title')}</h3>
              <p className="text-zinc-500 text-sm mt-1">{t('overview.insights.unavail.desc')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
