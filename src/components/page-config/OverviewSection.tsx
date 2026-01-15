'use client';

import { useEffect, useState } from 'react';
import { usePageConfig } from '@/contexts/PageConfigContext';

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
  const { insights, loading, error, fetchInsights, clearError } = usePageConfig();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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
      name: 'Followers',
      value: getMetricValue('page_followers_count'),
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      color: 'blue',
    },
    {
      name: 'Impressions',
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
      name: 'Engaged Users',
      value: getMetricValue('page_engaged_users'),
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
        </svg>
      ),
      color: 'green',
    },
    {
      name: 'Post Engagements',
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
    blue: 'from-blue-500 to-blue-700',
    purple: 'from-purple-500 to-purple-700',
    green: 'from-green-500 to-green-700',
    yellow: 'from-yellow-500 to-yellow-700',
  };

  if (loading && !insights) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
            Page Overview
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
            Page Overview
          </h2>
          {lastUpdated && (
            <p className="text-sm text-zinc-500 mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
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
          Refresh
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-red-400 font-medium">Unable to Load Insights</h3>
              <p className="text-red-300/80 text-sm mt-1">{error}</p>
              <p className="text-red-300/60 text-xs mt-2">
                Note: Facebook insights may take 24-48 hours to become available for newly connected pages.
              </p>
              <button
                onClick={() => {
                  clearError();
                  loadInsights();
                }}
                className="mt-3 text-sm text-red-400 hover:text-red-300 underline"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <div
            key={metric.name}
            className="bg-[#0a0a0a] border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all"
          >
            <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${colorClasses[metric.color as keyof typeof colorClasses]} flex items-center justify-center mb-4`}>
              <div className="text-white">{metric.icon}</div>
            </div>
            <p className="text-zinc-400 text-sm mb-1">{metric.name}</p>
            <p className="text-white text-3xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>
              {metric.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Info Box */}
      {(!insights || insights.data.length === 0) && !error && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="text-blue-400 font-medium">Insights Not Available</h3>
              <p className="text-blue-300/80 text-sm mt-1">
                Facebook Page Insights require additional permissions that are currently under review by Facebook.
                In the meantime, you can still use the Messages and AI Settings features to manage your page.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
