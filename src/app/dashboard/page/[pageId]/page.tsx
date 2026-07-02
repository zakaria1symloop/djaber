'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePages } from '@/contexts/PagesContext';
import { PageConfigProvider } from '@/contexts/PageConfigContext';
import { Button } from '@/components/ui';
import {
  HomeIcon,
  ChatIcon,
  SettingsIcon,
  ClockIcon,
  BoxIcon,
  FacebookIcon,
  ChevronRightIcon,
} from '@/components/ui/icons';

import OverviewSection from '@/components/page-config/OverviewSection';
import MessagesSection from '@/components/page-config/MessagesSection';
import AISettingsSection from '@/components/page-config/AISettingsSection';
import MessageHistorySection from '@/components/page-config/MessageHistorySection';
import { useTranslation } from '@/contexts/LanguageContext';

type Section = 'overview' | 'messages' | 'ai-settings' | 'history';

const sectionDefs: Array<{ id: Section; key: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', key: 'pageDetail.tab.overview', icon: HomeIcon },
  { id: 'messages', key: 'pageDetail.tab.messages', icon: ChatIcon },
  { id: 'ai-settings', key: 'pageDetail.tab.aiSettings', icon: SettingsIcon },
  { id: 'history', key: 'pageDetail.tab.history', icon: ClockIcon },
];

function PageConfigContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { pages, loading: pagesLoading } = usePages();

  const pageId = params?.pageId as string;
  const currentPage = pages.find((p) => p.id === pageId);

  const initialSection = ((): Section => {
    const t = searchParams?.get('tab');
    return t === 'messages' || t === 'ai-settings' || t === 'history' || t === 'overview' ? (t as Section) : 'overview';
  })();
  const [activeSection, setActiveSection] = useState<Section>(initialSection);

  const changeSection = (s: Section) => {
    setActiveSection(s);
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('tab', s);
    router.replace(`/dashboard/page/${pageId}?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (!pagesLoading && !currentPage) router.push('/dashboard');
  }, [pagesLoading, currentPage, router]);

  if (authLoading || pagesLoading || !currentPage) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-zinc-400 text-sm">Loading…</div>
      </div>
    );
  }

  const PlatformIcon = FacebookIcon;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-zinc-500">
        <button
          onClick={() => router.push('/dashboard?section=pages')}
          className="hover:text-white transition-colors"
        >
          {t('pageDetail.crumb.pages')}
        </button>
        <ChevronRightIcon className="w-3 h-3" />
        <span className="text-white">{currentPage.pageName}</span>
      </nav>

      {/* Page header card */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 text-zinc-500 flex items-center justify-center flex-shrink-0">
              <PlatformIcon className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-bold text-white truncate" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {currentPage.pageName}
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-white/10 bg-white/[0.03] text-[11px] text-zinc-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  {t('pageDetail.status.active')}
                </span>
              </div>
              <p className="text-xs text-zinc-500 capitalize">
                {currentPage.platform} · {t('pageDetail.connected')} {new Date(currentPage.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={<BoxIcon className="w-4 h-4" />}
            onClick={() => router.push(`/dashboard/page/${pageId}/stock`)}
          >
            {t('pageDetail.openStock')}
          </Button>
        </div>
      </div>

      {/* Section tabs */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-1 inline-flex flex-wrap gap-1">
        {sectionDefs.map((s) => {
          const Icon = s.icon;
          const active = activeSection === s.id;
          return (
            <button
              key={s.id}
              onClick={() => changeSection(s.id)}
              className={`inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                active
                  ? 'bg-white text-black'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t(s.key)}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div>
        {activeSection === 'overview' && <OverviewSection pageId={pageId} page={currentPage} />}
        {activeSection === 'messages' && <MessagesSection pageId={pageId} page={currentPage} />}
        {activeSection === 'ai-settings' && <AISettingsSection pageId={pageId} page={currentPage} />}
        {activeSection === 'history' && <MessageHistorySection pageId={pageId} page={currentPage} />}
      </div>
    </div>
  );
}

export default function PageConfigPage() {
  return (
    <PageConfigProvider>
      <PageConfigContent />
    </PageConfigProvider>
  );
}
