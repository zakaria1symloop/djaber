'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePages } from '@/contexts/PagesContext';
import { PageConfigProvider } from '@/contexts/PageConfigContext';
import {
  Button,
  FacebookIcon,
  InstagramIcon,
  ChatIcon,
} from '@/components/ui';
import { RefreshIcon, ChevronDownIcon, PlusIcon } from '@/components/ui/icons';
import MessagesSection from '@/components/page-config/MessagesSection';
import { syncPageFromFacebook } from '@/lib/page-config-api';
import { useToast } from '@/components/ui/Toast';

export default function InboxPage() {
  return (
    <Suspense fallback={<div className="text-zinc-400 text-sm">Loading…</div>}>
      <InboxInner />
    </Suspense>
  );
}

function InboxInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { pages, loading: pagesLoading } = usePages();
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const activePages = useMemo(() => pages.filter((p) => p.isActive), [pages]);
  const requestedPageId = searchParams?.get('pageId') || null;

  const selectedPage = useMemo(() => {
    if (requestedPageId) {
      const found = activePages.find((p) => p.id === requestedPageId);
      if (found) return found;
    }
    return activePages[0] || null;
  }, [activePages, requestedPageId]);

  useEffect(() => {
    if (!selectedPage) return;
    if (requestedPageId !== selectedPage.id) {
      const sp = new URLSearchParams(searchParams?.toString() || '');
      sp.set('pageId', selectedPage.id);
      router.replace(`/dashboard/inbox?${sp.toString()}`, { scroll: false });
    }
  }, [selectedPage, requestedPageId]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchPage = (id: string) => {
    const sp = new URLSearchParams(searchParams?.toString() || '');
    sp.set('pageId', id);
    router.replace(`/dashboard/inbox?${sp.toString()}`, { scroll: false });
  };

  const handleSync = async () => {
    if (!selectedPage || syncing) return;
    setSyncing(true);
    try {
      const r = await syncPageFromFacebook(selectedPage.id);
      const newCount = r.newConversations + r.newMessages;
      toast.success(newCount > 0 ? `Synced — ${r.newMessages} new message${r.newMessages === 1 ? '' : 's'}` : 'Up to date');
      setLastSyncedAt(new Date());
      // PageConfigContext (rendered below) will re-fetch when its key changes; force a remount via state below
      setSyncToken((t) => t + 1);
    } catch (err: any) {
      toast.error(err?.message || 'Could not reach Facebook. Try again.');
    } finally {
      setSyncing(false);
    }
  };

  const [syncToken, setSyncToken] = useState(0);

  if (pagesLoading) {
    return <div className="text-zinc-400 text-sm">Loading pages…</div>;
  }

  if (activePages.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader subtitle="Read and reply to your customer messages." />
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 mx-auto mb-4 flex items-center justify-center">
            <ChatIcon className="w-6 h-6 text-zinc-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">No pages connected</h3>
          <p className="text-sm text-zinc-500 max-w-md mx-auto mb-5">
            Connect a Facebook or Instagram page to start receiving messages here.
          </p>
          <Button onClick={() => router.push('/dashboard?section=pages')}>
            Connect a page
          </Button>
        </div>
      </div>
    );
  }

  const lastSyncedLabel = lastSyncedAt
    ? formatRelative(lastSyncedAt)
    : null;

  return (
    // Full-height inbox: own header on top, messenger fills the remaining viewport height
    <div className="flex flex-col gap-4 h-[calc(100vh-7rem)] min-h-[560px]">
      {/* Top bar — single row */}
      <div className="bg-zinc-900/60 backdrop-blur border border-white/10 rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 flex flex-wrap items-center gap-3">
        <PageSwitcher
          pages={activePages}
          selected={selectedPage}
          onSelect={switchPage}
          onConnectMore={() => router.push('/dashboard?section=pages')}
          lastSyncedLabel={lastSyncedLabel}
        />

        <div className="ms-auto flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSync}
            disabled={syncing || !selectedPage}
            icon={<RefreshIcon className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />}
          >
            {syncing ? 'Syncing…' : 'Sync'}
          </Button>
        </div>
      </div>

      {/* Messenger — fills remaining height */}
      {selectedPage && (
        <PageConfigProvider key={`${selectedPage.id}-${syncToken}`}>
          <MessagesSection
            pageId={selectedPage.id}
            page={selectedPage}
            hideHeader
            fullHeight
          />
        </PageConfigProvider>
      )}
    </div>
  );
}

interface SwitcherPage {
  id: string;
  pageName: string;
  platform: string;
}

function PageSwitcher({
  pages,
  selected,
  onSelect,
  onConnectMore,
  lastSyncedLabel,
}: {
  pages: SwitcherPage[];
  selected: SwitcherPage | null;
  onSelect: (id: string) => void;
  onConnectMore: () => void;
  lastSyncedLabel: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOut = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOut);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickOut);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  if (!selected) return null;
  const SelectedIcon = selected.platform === 'instagram' ? InstagramIcon : FacebookIcon;
  const selectedColor = selected.platform === 'instagram' ? 'text-pink-400' : 'text-[#1877F2]';
  const multi = pages.length > 1;

  return (
    <div className="relative min-w-0" ref={ref}>
      <button
        onClick={() => multi && setOpen((v) => !v)}
        disabled={!multi}
        className={`flex items-center gap-2.5 min-w-0 max-w-full pe-2 ps-1 py-1 rounded-xl transition-colors ${
          multi ? 'hover:bg-white/5 cursor-pointer' : 'cursor-default'
        }`}
      >
        <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
          <SelectedIcon className={`w-4 h-4 ${selectedColor}`} />
        </div>
        <div className="min-w-0 text-start">
          <div className="flex items-center gap-1.5">
            <h1
              className="text-base sm:text-lg font-bold text-white leading-tight truncate max-w-[200px] sm:max-w-[300px]"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              {selected.pageName}
            </h1>
            {multi && (
              <ChevronDownIcon
                className={`w-4 h-4 text-zinc-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
              />
            )}
          </div>
          <p className="text-[11px] text-zinc-500 leading-tight">
            {selected.platform === 'instagram' ? 'Instagram DMs' : 'Messenger'}
            {lastSyncedLabel && <span className="text-zinc-600"> · synced {lastSyncedLabel}</span>}
          </p>
        </div>
      </button>

      {open && (
        <div className="absolute top-full start-0 mt-2 w-72 max-w-[90vw] bg-zinc-950 border border-white/10 rounded-xl shadow-2xl z-30 overflow-hidden">
          <div className="px-3 pt-2 pb-1.5">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Switch page</p>
          </div>
          <ul className="max-h-72 overflow-y-auto pb-1">
            {pages.map((p) => {
              const active = p.id === selected.id;
              const Icon = p.platform === 'instagram' ? InstagramIcon : FacebookIcon;
              const color = p.platform === 'instagram' ? 'text-pink-400' : 'text-[#1877F2]';
              return (
                <li key={p.id}>
                  <button
                    onClick={() => {
                      onSelect(p.id);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-start transition-colors ${
                      active ? 'bg-white/5' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                      <Icon className={`w-3.5 h-3.5 ${color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm truncate ${active ? 'text-white font-semibold' : 'text-zinc-200'}`}>
                        {p.pageName}
                      </p>
                      <p className="text-[10px] text-zinc-500 capitalize">{p.platform}</p>
                    </div>
                    {active && (
                      <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold flex-shrink-0">
                        Active
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            onClick={() => {
              setOpen(false);
              onConnectMore();
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-zinc-400 hover:text-white hover:bg-white/5 border-t border-white/5 transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Connect another page
          </button>
        </div>
      )}
    </div>
  );
}

function PageHeader({ subtitle }: { subtitle: string }) {
  return (
    <header>
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-1">Customer messages</p>
      <h1
        className="text-2xl sm:text-3xl font-bold text-white"
        style={{ fontFamily: 'Syne, sans-serif' }}
      >
        Inbox
      </h1>
      <p className="text-sm text-zinc-500 mt-1">{subtitle}</p>
    </header>
  );
}

function formatRelative(d: Date): string {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleDateString();
}
