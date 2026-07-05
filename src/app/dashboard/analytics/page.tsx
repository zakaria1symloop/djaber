'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from '@/contexts/LanguageContext';
import ProductsTab from './_components/ProductsTab';
import ChannelsTab from './_components/ChannelsTab';
import AgentsTab from './_components/AgentsTab';
import OrdersTab from './_components/OrdersTab';
import ConversationsTab from './_components/ConversationsTab';
import ResponsesTab from './_components/ResponsesTab';
import ConsumptionTab from './_components/ConsumptionTab';

// AI-first ordering — the agent story leads, commerce follows.
const TABS = [
  { key: 'conversations', label: 'Conversations', group: 'AI' },
  { key: 'responses', label: 'Responses', group: 'AI' },
  { key: 'consumption', label: 'Consumption', group: 'AI' },
  { key: 'agents', label: 'AI Agents', group: 'AI' },
  { key: 'channels', label: 'Channels', group: 'AI' },
  { key: 'products', label: 'Products', group: 'Commerce' },
  { key: 'orders', label: 'Orders', group: 'Commerce' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function isTabKey(value: string | null): value is TabKey {
  return TABS.some((t) => t.key === value);
}

function AnalyticsHub() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get('tab');
  const tab: TabKey = isTabKey(rawTab) ? rawTab : 'conversations';

  const setTab = (key: TabKey) => {
    router.replace(`${pathname}?tab=${key}`, { scroll: false });
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-1.5">{t('an.tab.hub.eyebrow')}</p>
          <h1
            className="text-2xl sm:text-3xl font-bold text-white"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            {t('an.tab.hub.title')}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">{t('an.tab.hub.subtitle')}</p>
        </div>
        <Link
          href="/dashboard?section=analytics"
          className="text-xs text-zinc-500 hover:text-white transition-colors"
        >
          {t('an.tab.hub.classic')} &rarr;
        </Link>
      </div>

      {/* Tab bar — segmented control */}
      <div className="flex gap-1 border border-white/10 rounded-lg p-0.5 w-fit mb-6 overflow-x-auto max-w-full">
        {TABS.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`text-xs px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
              tab === item.key
                ? 'bg-white text-black font-semibold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {t(`an.tab.hub.tab.${item.key}`)}
          </button>
        ))}
      </div>

      {tab === 'conversations' && <ConversationsTab />}
      {tab === 'responses' && <ResponsesTab />}
      {tab === 'consumption' && <ConsumptionTab />}
      {tab === 'agents' && <AgentsTab />}
      {tab === 'channels' && <ChannelsTab />}
      {tab === 'products' && <ProductsTab />}
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
