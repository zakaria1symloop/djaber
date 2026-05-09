'use client';

import { Suspense, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePages } from '@/contexts/PagesContext';
import { PageConfigProvider } from '@/contexts/PageConfigContext';
import { Button, FacebookIcon, InstagramIcon, ChatIcon } from '@/components/ui';
import MessagesSection from '@/components/page-config/MessagesSection';

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
  const { pages, loading: pagesLoading } = usePages();

  const activePages = useMemo(() => pages.filter((p) => p.isActive), [pages]);
  const requestedPageId = searchParams?.get('pageId') || null;

  const selectedPage = useMemo(() => {
    if (requestedPageId) {
      const found = activePages.find((p) => p.id === requestedPageId);
      if (found) return found;
    }
    return activePages[0] || null;
  }, [activePages, requestedPageId]);

  // Reflect default selection in the URL once we land on the page
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

  if (pagesLoading) {
    return <div className="text-zinc-400 text-sm">Loading pages…</div>;
  }

  if (activePages.length === 0) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
            Inbox
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Read and reply to your customer messages here.</p>
        </header>
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

  return (
    <div className="space-y-5">
      {/* Header + page picker */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-1">Customer messages</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
            Inbox
          </h1>
        </div>
        {activePages.length > 1 && (
          <div className="bg-zinc-900/60 border border-white/10 rounded-xl p-1 inline-flex flex-wrap gap-1 max-w-full overflow-x-auto">
            {activePages.map((p) => {
              const active = selectedPage?.id === p.id;
              const Icon = p.platform === 'instagram' ? InstagramIcon : FacebookIcon;
              return (
                <button
                  key={p.id}
                  onClick={() => switchPage(p.id)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-white text-black'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? '' : p.platform === 'instagram' ? 'text-pink-400' : 'text-[#1877F2]'}`} />
                  <span className="max-w-[140px] truncate">{p.pageName}</span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Single connected page indicator */}
      {activePages.length === 1 && selectedPage && (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          {selectedPage.platform === 'instagram' ? (
            <InstagramIcon className="w-3.5 h-3.5 text-pink-400" />
          ) : (
            <FacebookIcon className="w-3.5 h-3.5 text-[#1877F2]" />
          )}
          <span>{selectedPage.pageName}</span>
        </div>
      )}

      {selectedPage && (
        <PageConfigProvider>
          <MessagesSection pageId={selectedPage.id} page={selectedPage} />
        </PageConfigProvider>
      )}
    </div>
  );
}
