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
import { useTranslation } from '@/contexts/LanguageContext';

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
  const { t } = useTranslation();

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
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-1">{t('history.kicker')}</p>
          <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
            {t('history.title')}
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            {loading && !messages
              ? t('history.loading')
              : t('history.count').replace('{n}', total.toLocaleString()).replace(/\{plural\}/g, total === 1 ? '' : 's')}
            {hasAppliedFilters && ` · ${t('history.filtered')}`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          disabled={loading}
          icon={<RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
        >
          {t('history.refresh')}
        </Button>
      </header>

      {/* Filter card */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-4 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
              {t('history.filter.direction')}
            </label>
            <div className="bg-black border border-white/10 rounded-lg p-1 inline-flex w-full">
              {(
                [
                  { v: 'all', label: t('history.dir.all') },
                  { v: 'incoming', label: t('history.dir.in') },
                  { v: 'outgoing', label: t('history.dir.out') },
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
              {t('history.filter.from')}
            </label>
            <DatePicker value={draftFrom} onChange={setDraftFrom} placeholder={t('history.filter.from')} />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
              {t('history.filter.to')}
            </label>
            <DatePicker value={draftTo} onChange={setDraftTo} placeholder={t('history.filter.to')} />
          </div>

          <div className="flex items-end gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={apply}
              disabled={loading || !filtersDirty}
            >
              {t('history.btn.apply')}
            </Button>
            {(filtersDirty || hasAppliedFilters) && (
              <Button size="sm" variant="ghost" onClick={clear}>
                {t('history.btn.clear')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-400">{t('history.error.title')}</p>
            <p className="text-xs text-red-400/80 mt-0.5">{error}</p>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() => {
                clearError();
                load();
              }}
            >
              {t('msg.error.retry')}
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
          <p className="text-sm font-semibold text-white mb-1">{t('history.empty.title')}</p>
          <p className="text-xs text-zinc-500">
            {hasAppliedFilters ? t('history.empty.filtered') : t('history.empty.none')}
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-[170px_1fr_100px_2fr] gap-3 px-4 py-3 border-b border-white/5 text-[10px] uppercase tracking-wider text-zinc-500">
            <span>{t('history.col.date')}</span>
            <span>{t('history.col.sender')}</span>
            <span>{t('history.col.direction')}</span>
            <span>{t('history.col.message')}</span>
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
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/[0.03] text-zinc-300 border border-white/10">
                        <ArrowUpIcon className="w-3 h-3" />
                        {t('history.tag.out')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/[0.03] text-zinc-300 border border-white/10">
                        <ArrowDownIcon className="w-3 h-3" />
                        {t('history.tag.in')}
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-zinc-300 truncate">
                    {m.text || <span className="text-zinc-600 italic">{t('history.empty.noText')}</span>}
                  </span>
                </div>
                {/* Mobile row */}
                <div className="sm:hidden px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-white truncate">
                      {m.senderName || `${m.senderId.substring(0, 12)}…`}
                    </span>
                    {m.isFromPage ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/[0.03] text-zinc-300 border border-white/10">
                        <ArrowUpIcon className="w-3 h-3" />
                        {t('history.tag.out')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/[0.03] text-zinc-300 border border-white/10">
                        <ArrowDownIcon className="w-3 h-3" />
                        {t('history.tag.in')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-300 line-clamp-2">
                    {m.text || <span className="text-zinc-600 italic">{t('history.empty.noText')}</span>}
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
