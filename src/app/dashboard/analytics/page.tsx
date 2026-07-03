'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import ProductsTab from './_components/ProductsTab';
import ChannelsTab from './_components/ChannelsTab';
import AgentsTab from './_components/AgentsTab';
import OrdersTab from './_components/OrdersTab';

const TABS = [
  { key: 'products', label: 'Products' },
  { key: 'channels', label: 'Channels' },
  { key: 'agents', label: 'AI Agents' },
  { key: 'orders', label: 'Orders' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function isTabKey(value: string | null): value is TabKey {
  return TABS.some((t) => t.key === value);
}

function AnalyticsHub() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get('tab');
  const tab: TabKey = isTabKey(rawTab) ? rawTab : 'products';

  const setTab = (key: TabKey) => {
    router.replace(`${pathname}?tab=${key}`, { scroll: false });
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-1.5">Insights</p>
          <h1
            className="text-2xl sm:text-3xl font-bold text-white"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Analytics
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Deep performance analytics for your business</p>
        </div>
        <Link
          href="/dashboard?section=analytics"
          className="text-xs text-zinc-500 hover:text-white transition-colors"
        >
          Classic overview &rarr;
        </Link>
      </div>

      {/* Tab bar — segmented control */}
      <div className="flex gap-1 border border-white/10 rounded-lg p-0.5 w-fit mb-6 overflow-x-auto max-w-full">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-xs px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
              tab === t.key
                ? 'bg-white text-black font-semibold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'products' && <ProductsTab />}
      {tab === 'channels' && <ChannelsTab />}
      {tab === 'agents' && <AgentsTab />}
      {tab === 'orders' && <OrdersTab />}
    </div>
  );
}

function HubSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-3 w-16 bg-zinc-900/60 rounded" />
        <div className="h-8 w-48 bg-zinc-900/60 rounded" />
        <div className="h-4 w-72 bg-zinc-900/60 rounded" />
      </div>
      <div className="h-9 w-72 bg-zinc-900/60 rounded-lg" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-zinc-900/60 rounded-xl" />
        ))}
      </div>
      <div className="h-80 bg-zinc-900/60 rounded-xl" />
    </div>
  );
}

export default function AnalyticsPage() {
  // useSearchParams requires a Suspense boundary during static rendering.
  return (
    <Suspense fallback={<HubSkeleton />}>
      <AnalyticsHub />
    </Suspense>
  );
}
