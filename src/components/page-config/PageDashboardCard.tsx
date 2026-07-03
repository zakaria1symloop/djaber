'use client';

import { useEffect, useState } from 'react';
import { FacebookIcon, InstagramIcon, BoxIcon, SettingsIcon, ChatIcon, CloseIcon } from '@/components/ui';
import { SparklesIcon, RefreshIcon } from '@/components/ui/icons';
import { getPageSummary, type PageSummary } from '@/lib/page-config-api';
import { useTranslation } from '@/contexts/LanguageContext';

interface Props {
  page: { id: string; pageName: string; platform: string; createdAt: string };
  onConfigure: () => void;
  onStock: () => void;
  onInbox: () => void;
  onGenerateAgent: () => void;
  onDisconnect: () => void;
}

export default function PageDashboardCard({ page, onConfigure, onStock, onInbox, onGenerateAgent, onDisconnect }: Props) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<PageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  const refresh = async () => {
    try {
      setLoading(true);
      const s = await getPageSummary(page.id);
      setSummary(s);
    } catch {
      // Endpoint may not be deployed yet — fail silently to a minimal card
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id]);

  const Icon = page.platform === 'instagram' ? InstagramIcon : FacebookIcon;

  const conv = summary?.conversations;
  const msgs = summary?.messages;
  const agent = summary?.agent;

  const lastActivity = summary?.lastActivity ? formatRelative(new Date(summary.lastActivity), t) : t('pageCard.lastActivity.none');

  return (
    <div className="bg-zinc-900/50 border border-white/10 rounded-2xl hover:border-white/20 transition-colors">
      <div className="p-5">
        {/* Identity row */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl overflow-hidden border border-white/10 bg-zinc-900 flex items-center justify-center flex-shrink-0">
              {summary?.pictureUrl && !imgError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={summary.pictureUrl}
                  alt={page.pageName}
                  className="w-full h-full object-cover grayscale"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                />
              ) : (
                <Icon className="w-5 h-5 text-zinc-500" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white truncate" style={{ fontFamily: 'Syne, sans-serif' }}>
                {page.pageName}
              </h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                <span className="capitalize">{page.platform}</span>
                <span className="text-zinc-700"> · </span>
                {lastActivity}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 pt-0.5">
            {summary && (
              <span className="flex items-center gap-1.5 text-[11px] text-zinc-400 whitespace-nowrap">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    agent?.enabled ? 'bg-white' : 'border border-zinc-600'
                  }`}
                />
                {agent?.enabled ? t('pageCard.aiOn') : t('pageCard.aiOff')}
              </span>
            )}
            <button
              onClick={refresh}
              className="text-zinc-600 hover:text-white p-1 transition-colors"
              title={t('pageCard.refresh')}
            >
              <RefreshIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats band */}
        <div className="grid grid-cols-4 gap-2 py-4 mb-4 border-y border-white/[0.07]">
          <Stat
            label={t('pageCard.stat.convos')}
            value={conv?.total ?? '–'}
            subtle={t('pageCard.stat.active').replace('{n}', String(conv?.active ?? 0))}
          />
          <Stat
            label={t('pageCard.stat.msgs7d')}
            value={msgs?.last7d ?? '–'}
            subtle={t('pageCard.stat.in').replace('{n}', String(msgs?.incoming7d ?? 0))}
          />
          <Stat
            label={t('pageCard.stat.unread')}
            value={conv?.unread ?? '–'}
            subtle={(conv?.unread ?? 0) > 0 ? t('pageCard.stat.needsReply', 'needs reply') : undefined}
          />
          <Stat
            label={t('pageCard.stat.stock')}
            value={summary?.products ?? '–'}
            subtle={t('pageCard.stat.products')}
          />
        </div>

        {/* Agent strip */}
        <div className="mb-4 rounded-xl p-3 border border-white/[0.07] bg-white/[0.02] flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/5 text-zinc-300 flex items-center justify-center flex-shrink-0">
            <SparklesIcon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            {agent?.enabled && agent.hasInstructions ? (
              <>
                <p className="text-xs font-semibold text-white">
                  {t('pageCard.agent.ready')}
                  <span className="font-normal text-zinc-500 capitalize"> · {agent.personality}</span>
                </p>
                <p className="text-[11px] text-zinc-500 truncate">{t('pageCard.agent.tailored')}</p>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold text-white">{t('pageCard.agent.notReady')}</p>
                <p className="text-[11px] text-zinc-500 truncate">{t('pageCard.agent.notReadyHint')}</p>
              </>
            )}
          </div>
          <button
            onClick={onGenerateAgent}
            className="text-[11px] font-semibold px-2.5 py-1.5 bg-white text-black hover:bg-zinc-200 rounded-lg whitespace-nowrap transition-colors"
          >
            {agent?.enabled && agent.hasInstructions ? t('pageCard.agent.regenerate') : t('pageCard.agent.generate')}
          </button>
        </div>

        {/* Action row */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onInbox}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-white/[0.07] hover:border-white/20 text-zinc-400 hover:text-white rounded-lg text-xs font-medium transition-colors"
          >
            <ChatIcon className="w-3.5 h-3.5" />
            {t('pageCard.action.inbox')}
          </button>
          <button
            onClick={onStock}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-white/[0.07] hover:border-white/20 text-zinc-400 hover:text-white rounded-lg text-xs font-medium transition-colors"
          >
            <BoxIcon className="w-3.5 h-3.5" />
            {t('pageCard.action.stock')}
          </button>
          <button
            onClick={onConfigure}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-white/[0.07] hover:border-white/20 text-zinc-400 hover:text-white rounded-lg text-xs font-medium transition-colors"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            {t('pageCard.action.configure')}
          </button>
          <button
            onClick={onDisconnect}
            className="px-2 py-2 text-zinc-600 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            title={t('pageCard.action.disconnect')}
          >
            <CloseIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, subtle }: { label: string; value: number | string; subtle?: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.15em] text-zinc-500 mb-0.5">{label}</p>
      <p className="text-base font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
        {value}
      </p>
      {subtle && <p className="text-[9px] text-zinc-600 truncate">{subtle}</p>}
    </div>
  );
}

function formatRelative(date: Date, t: (key: string, fb?: string) => string): string {
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  const hour = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (min < 1) return t('pageCard.lastActivity.now');
  if (min < 60) return `${min}m`;
  if (hour < 24) return `${hour}h`;
  if (day < 30) return `${day}d`;
  return date.toLocaleDateString();
}
