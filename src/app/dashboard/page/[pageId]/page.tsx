'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePages } from '@/contexts/PagesContext';
import { PageConfigProvider } from '@/contexts/PageConfigContext';
import { Button, Badge } from '@/components/ui';
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

type Section = 'overview' | 'messages' | 'ai-settings' | 'history';

const sections: Array<{ id: Section; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: HomeIcon },
  { id: 'messages', label: 'Messages', icon: ChatIcon },
  { id: 'ai-settings', label: 'AI Settings', icon: SettingsIcon },
  { id: 'history', label: 'History', icon: ClockIcon },
];

function PageConfigContent() {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { pages, loading: pagesLoading } = usePages();
  const [activeSection, setActiveSection] = useState<Section>('overview');

  const pageId = params?.pageId as string;
  const currentPage = pages.find((p) => p.id === pageId);

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
  const platformColor = '#1877F2';

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-zinc-500">
        <button
          onClick={() => router.push('/dashboard?section=pages')}
          className="hover:text-white transition-colors"
        >
          Pages
        </button>
        <ChevronRightIcon className="w-3 h-3" />
        <span className="text-white">{currentPage.pageName}</span>
      </nav>

      {/* Page header card */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0"
              style={{ color: platformColor }}
            >
              <PlatformIcon className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-bold text-white truncate" style={{ fontFamily: 'Syne, sans-serif' }}>
                  {currentPage.pageName}
                </h1>
                <Badge variant="success">Active</Badge>
              </div>
              <p className="text-xs text-zinc-500 capitalize">
                {currentPage.platform} · Connected {new Date(currentPage.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={<BoxIcon className="w-4 h-4" />}
            onClick={() => router.push(`/dashboard/page/${pageId}/stock`)}
          >
            Open Stock
          </Button>
        </div>
      </div>

      {/* Section tabs */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-1 inline-flex flex-wrap gap-1">
        {sections.map((s) => {
          const Icon = s.icon;
          const active = activeSection === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                active
                  ? 'bg-white text-black'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              {s.label}
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
