'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, FacebookIcon, InstagramIcon, BoxIcon, SettingsIcon, ChatIcon, CloseIcon } from '@/components/ui';
import { SparklesIcon, RefreshIcon } from '@/components/ui/icons';
import { getPageSummary, type PageSummary } from '@/lib/page-config-api';

interface Props {
  page: { id: string; pageName: string; platform: string; createdAt: string };
  onConfigure: () => void;
  onStock: () => void;
  onInbox: () => void;
  onGenerateAgent: () => void;
  onDisconnect: () => void;
}

export default function PageDashboardCard({ page, onConfigure, onStock, onInbox, onGenerateAgent, onDisconnect }: Props) {
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
  const platformColor = page.platform === 'instagram' ? 'text-pink-400' : 'text-[#1877F2]';
  const platformBg = page.platform === 'instagram' ? 'from-pink-500/10 to-amber-500/10' : 'from-blue-500/10 to-blue-700/10';

  const conv = summary?.conversations;
  const msgs = summary?.messages;
  const agent = summary?.agent;

  const lastActivity = summary?.lastActivity ? formatRelative(new Date(summary.lastActivity)) : 'No activity yet';

  return (
    <div className="bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-colors">
      {/* Header banner */}
      <div className={`relative h-20 bg-gradient-to-br ${platformBg}`}>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22 viewBox=%220 0 40 40%22><circle cx=%221%22 cy=%221%22 r=%221%22 fill=%22white%22 fill-opacity=%220.05%22/></svg>')]" />
        <div className="absolute top-3 end-3 flex items-center gap-1.5">
          {summary && agent?.enabled ? (
            <Badge variant="success" size="sm">AI on</Badge>
          ) : summary ? (
            <Badge variant="warning" size="sm">AI off</Badge>
          ) : null}
          {summary && conv && conv.unread > 0 && (
            <span className="px-2 py-0.5 bg-rose-500 text-white text-[10px] font-bold rounded-full">
              {conv.unread} unread
            </span>
          )}
        </div>
      </div>

      <div className="px-5 -mt-10 relative">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-2xl bg-zinc-950 border-4 border-zinc-950 overflow-hidden flex items-center justify-center mb-3 shadow-xl">
          {summary?.pictureUrl && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={summary.pictureUrl}
              alt={page.pageName}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
              <Icon className={`w-7 h-7 ${platformColor}`} />
            </div>
          )}
        </div>

        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-white truncate" style={{ fontFamily: 'Syne, sans-serif' }}>
              {page.pageName}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <Icon className={`w-3 h-3 ${platformColor}`} />
              <span className="text-[11px] text-zinc-500 capitalize">{page.platform}</span>
              <span className="text-zinc-700">·</span>
              <span className="text-[11px] text-zinc-500">{lastActivity}</span>
            </div>
          </div>
          <button
            onClick={refresh}
            className="text-zinc-600 hover:text-white p-1 transition-colors"
            title="Refresh stats"
          >
            <RefreshIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2 mb-4 pb-4 border-b border-white/5">
          <Stat label="Convos" value={conv?.total ?? '–'} subtle={`${conv?.active ?? 0} active`} />
          <Stat label="Msgs 7d" value={msgs?.last7d ?? '–'} subtle={`${msgs?.incoming7d ?? 0} in`} />
          <Stat label="Unread" value={conv?.unread ?? '–'} highlight={(conv?.unread ?? 0) > 0} />
          <Stat label="Stock" value={summary?.products ?? '–'} subtle="products" />
        </div>

        {/* Agent strip */}
        <div
          className={`mb-4 rounded-xl p-3 border flex items-center gap-3 ${
            agent?.enabled && agent.hasInstructions
              ? 'bg-emerald-500/5 border-emerald-500/20'
              : 'bg-amber-500/5 border-amber-500/20'
          }`}
        >
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
              agent?.enabled && agent.hasInstructions ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
            }`}
          >
            <SparklesIcon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            {agent?.enabled && agent.hasInstructions ? (
              <>
                <p className="text-xs font-semibold text-emerald-200">
                  AI agent ready · <span className="capitalize font-normal text-emerald-300/80">{agent.personality}</span>
                </p>
                <p className="text-[11px] text-emerald-300/70">Tailored to this page&apos;s inbox.</p>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold text-amber-200">No tailored agent yet</p>
                <p className="text-[11px] text-amber-300/70">Generate one from this page&apos;s recent conversations.</p>
              </>
            )}
          </div>
          <button
            onClick={onGenerateAgent}
            className="text-[11px] font-semibold px-2.5 py-1.5 bg-white text-black hover:bg-zinc-100 rounded-lg whitespace-nowrap transition-colors"
          >
            {agent?.enabled && agent.hasInstructions ? 'Regenerate' : 'Generate'}
          </button>
        </div>

        {/* Action row */}
        <div className="flex items-center gap-1.5 pb-4">
          <button
            onClick={onInbox}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
          >
            <ChatIcon className="w-3.5 h-3.5" />
            Inbox
          </button>
          <button
            onClick={onStock}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
          >
            <BoxIcon className="w-3.5 h-3.5" />
            Stock
          </button>
          <button
            onClick={onConfigure}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            Configure
          </button>
          <button
            onClick={onDisconnect}
            className="px-2 py-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            title="Disconnect"
          >
            <CloseIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, subtle, highlight }: { label: string; value: number | string; subtle?: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-zinc-500 mb-0.5">{label}</p>
      <p className={`text-base font-bold ${highlight ? 'text-rose-400' : 'text-white'}`} style={{ fontFamily: 'Syne, sans-serif' }}>
        {value}
      </p>
      {subtle && <p className="text-[9px] text-zinc-600 truncate">{subtle}</p>}
    </div>
  );
}

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  const hour = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  if (hour < 24) return `${hour}h ago`;
  if (day < 30) return `${day}d ago`;
  return date.toLocaleDateString();
}
