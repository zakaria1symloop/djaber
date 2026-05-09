'use client';

import { useEffect, useState } from 'react';
import { usePageConfig } from '@/contexts/PageConfigContext';
import { DatePicker, Pagination } from '@/components/stock';
import { Button } from '@/components/ui';
import {
  HistoryIcon,
  AlertIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  ChatIcon,
  RefreshIcon,
} from '@/components/ui/icons';

interface Page {
  id: string;
  pageName: string;
  platform: string;
}

interface MessageHistorySectionProps {
  pageId: string;
  page: Page;
}

const PER_PAGE = 50;

export default function MessageHistorySection({ pageId }: MessageHistorySectionProps) {
  const { messages, loading, error, fetchMessages, clearError } = usePageConfig();

  const [draftType, setDraftType] = useState<'all' | 'incoming' | 'outgoing'>('all');
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');

  const [appliedType, setAppliedType] = useState<'all' | 'incoming' | 'outgoing'>('all');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');

  const [offset, setOffset] = useState(0);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, offset, appliedType, appliedFrom, appliedTo]);

  const load = async () => {
    try {
      const params: any = { limit: PER_PAGE, offset };
      if (appliedType !== 'all') params.type = appliedType;
      if (appliedFrom) params.dateFrom = appliedFrom;
      if (appliedTo) params.dateTo = appliedTo;
      await fetchMessages(pageId, params);
    } catch {
      // handled by context
    }
  };

  const apply = () => {
    setAppliedType(draftType);
    setAppliedFrom(draftFrom);
    setAppliedTo(draftTo);
    setOffset(0);
  };

  const clear = () => {
    setDraftType('all');
    setDraftFrom('');
    setDraftTo('');
    setAppliedType('all');
    setAppliedFrom('');
    setAppliedTo('');
    setOffset(0);
  };

  const formatDateTime = (timestamp: string) =>
    new Date(timestamp).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const filtersDirty =
    draftType !== appliedType || draftFrom !== appliedFrom || draftTo !== appliedTo;
  const hasAppliedFilters =
    appliedType !== 'all' || !!appliedFrom || !!appliedTo;

  const total = messages?.total ?? 0;
  const list = messages?.messages ?? [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-1">Conversation log</p>
          <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
            Message history
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            {loading && !messages
              ? 'Loading…'
              : `${total.toLocaleString()} message${total === 1 ? '' : 's'}`}
            {hasAppliedFilters && ' · filtered'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          disabled={loading}
          icon={<RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
        >
          Refresh
        </Button>
      </header>

      {/* Filter card */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-4 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
              Direction
            </label>
            <div className="bg-black border border-white/10 rounded-lg p-1 inline-flex w-full">
              {(
                [
                  { v: 'all', label: 'All' },
                  { v: 'incoming', label: 'In' },
                  { v: 'outgoing', label: 'Out' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setDraftType(opt.v)}
                  className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    draftType === opt.v
                      ? 'bg-white text-black'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
              From
            </label>
            <DatePicker value={draftFrom} onChange={setDraftFrom} placeholder="From date" />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
              To
            </label>
            <DatePicker value={draftTo} onChange={setDraftTo} placeholder="To date" />
          </div>

          <div className="flex items-end gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={apply}
              disabled={loading || !filtersDirty}
            >
              Apply
            </Button>
            {(filtersDirty || hasAppliedFilters) && (
              <Button size="sm" variant="ghost" onClick={clear}>
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertIcon className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-rose-300">Could not load messages</p>
            <p className="text-xs text-rose-400/80 mt-0.5">{error}</p>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2 text-rose-300"
              onClick={() => {
                clearError();
                load();
              }}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Empty / loading / list */}
      {loading && !messages ? (
        <div className="bg-zinc-900/40 border border-white/10 rounded-2xl p-4 space-y-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="animate-pulse h-12 bg-white/[0.03] rounded-lg" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 mx-auto mb-3 flex items-center justify-center">
            <ChatIcon className="w-5 h-5 text-zinc-500" />
          </div>
          <p className="text-sm font-semibold text-white mb-1">No messages</p>
          <p className="text-xs text-zinc-500">
            {hasAppliedFilters
              ? 'No messages match your filters. Try widening the range.'
              : 'When this page exchanges messages, they will appear here.'}
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-[170px_1fr_100px_2fr] gap-3 px-4 py-3 border-b border-white/5 text-[10px] uppercase tracking-wider text-zinc-500">
            <span>Date</span>
            <span>Sender</span>
            <span>Direction</span>
            <span>Message</span>
          </div>
          <ul>
            {list.map((m) => (
              <li
                key={m.id}
                className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition-colors"
              >
                {/* Desktop row */}
                <div className="hidden sm:grid grid-cols-[170px_1fr_100px_2fr] gap-3 px-4 py-3 items-center">
                  <span className="text-xs text-zinc-500 whitespace-nowrap">
                    {formatDateTime(m.timestamp)}
                  </span>
                  <span className="text-sm text-white truncate">
                    {m.senderName || `${m.senderId.substring(0, 14)}…`}
                  </span>
                  <span>
                    {m.isFromPage ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        <ArrowUpIcon className="w-3 h-3" />
                        Out
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <ArrowDownIcon className="w-3 h-3" />
                        In
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-zinc-300 truncate">
                    {m.text || <span className="text-zinc-600 italic">(no text)</span>}
                  </span>
                </div>
                {/* Mobile row */}
                <div className="sm:hidden px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-white truncate">
                      {m.senderName || `${m.senderId.substring(0, 12)}…`}
                    </span>
                    {m.isFromPage ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        <ArrowUpIcon className="w-3 h-3" />
                        Out
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <ArrowDownIcon className="w-3 h-3" />
                        In
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-300 line-clamp-2">
                    {m.text || <span className="text-zinc-600 italic">(no text)</span>}
                  </p>
                  <p className="text-[10px] text-zinc-600 mt-1">{formatDateTime(m.timestamp)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Pagination total={total} limit={PER_PAGE} offset={offset} onPageChange={setOffset} />
    </div>
  );
}
