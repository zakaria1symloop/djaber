'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { BotIcon, EditIcon, AlertIcon } from '@/components/ui/icons';
import { useTranslation } from '@/contexts/LanguageContext';

interface Page {
  id: string;
  pageName: string;
  platform: string;
}

interface LinkedAgent {
  id: string;
  name: string;
  personality: string;
  aiModel: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  customInstructions: string | null;
  sellAllProducts: boolean;
  _count: { products: number; pages: number; conversations: number };
}

interface AISettingsSectionProps {
  pageId: string;
  page: Page;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6001';

export default function AISettingsSection({ pageId }: AISettingsSectionProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [agent, setAgent] = useState<LinkedAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAgent();
  }, [pageId]);

  const loadAgent = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/user-stock/agents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(t('aiSettings.error'));
      const data = await res.json();
      const linked = data.agents?.find((a: any) =>
        a.pages?.some((ap: any) => ap.pageId === pageId || ap.page?.id === pageId)
      );
      setAgent(linked || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('aiSettings.error'));
    } finally {
      setLoading(false);
    }
  };

  const personalityLabels: Record<string, { label: string; color: string }> = {
    professional: { label: t('aiSettings.personality.professional'), color: 'bg-white/5 text-zinc-400 border-white/10' },
    friendly: { label: t('aiSettings.personality.friendly'), color: 'bg-white/5 text-zinc-400 border-white/10' },
    casual: { label: t('aiSettings.personality.casual'), color: 'bg-white/5 text-zinc-400 border-white/10' },
    technical: { label: t('aiSettings.personality.technical'), color: 'bg-white/5 text-zinc-400 border-white/10' },
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-white/5 rounded w-48 animate-pulse" />
        <div className="h-48 bg-white/5 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{t('aiSettings.title')}</h2>
        <p className="text-xs text-zinc-500 mt-0.5">{t('aiSettings.subtitle')}</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
          {error}
          <button onClick={loadAgent} className="ml-2 underline text-xs">{t('aiSettings.retry')}</button>
        </div>
      )}

      {agent ? (
        <div className="space-y-4">
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                  agent.isActive ? 'bg-white/5 text-zinc-300' : 'bg-white/5 text-zinc-500'
                }`}>
                  <BotIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{agent.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                      personalityLabels[agent.personality]?.color || 'bg-white/5 text-zinc-400 border-white/10'
                    }`}>
                      {personalityLabels[agent.personality]?.label || agent.personality}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-white/10 bg-white/[0.03] text-[11px] ${agent.isActive ? 'text-zinc-300' : 'text-zinc-600'}`}>
                      {agent.isActive && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      {agent.isActive ? t('aiSettings.active') : t('aiSettings.inactive')}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                icon={<EditIcon className="w-3.5 h-3.5" />}
                onClick={() => router.push(`/dashboard/agents/${agent.id}`)}
              >
                {t('aiSettings.edit')}
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <InfoTile label={t('aiSettings.tile.model')} value={agent.aiModel} />
              <InfoTile label={t('aiSettings.tile.temperature')} value={agent.temperature.toFixed(1)} />
              <InfoTile label={t('aiSettings.tile.maxTokens')} value={agent.maxTokens.toString()} />
              <InfoTile
                label={t('aiSettings.tile.products')}
                value={agent.sellAllProducts ? t('aiSettings.tile.allProducts') : t('aiSettings.tile.selectedProducts').replace('{n}', String(agent._count.products))}
              />
            </div>

            {agent.customInstructions && (
              <div>
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">{t('aiSettings.customInstructions')}</p>
                <div className="bg-black/40 border border-white/5 rounded-lg p-3">
                  <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">{agent.customInstructions}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5 text-xs text-zinc-500">
              <span>
                {t('aiSettings.linked.pages').replace('{n}', String(agent._count.pages)).replace(/\{plural\}/g, agent._count.pages !== 1 ? 's' : '')}
              </span>
              <span>·</span>
              <span>
                {t('aiSettings.linked.convs').replace('{n}', String(agent._count.conversations)).replace(/\{plural\}/g, agent._count.conversations !== 1 ? 's' : '')}
              </span>
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
            <p className="text-xs text-zinc-500">{t('aiSettings.help')}</p>
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-8 text-center">
          <div className="w-14 h-14 rounded-xl bg-white/5 text-zinc-300 flex items-center justify-center mx-auto mb-3">
            <AlertIcon className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">{t('aiSettings.empty.title')}</h3>
          <p className="text-xs text-zinc-400 mb-4 max-w-md mx-auto">{t('aiSettings.empty.desc')}</p>
          <Button
            onClick={() => router.push('/dashboard/agents')}
            icon={<BotIcon className="w-4 h-4" />}
          >
            {t('aiSettings.empty.cta')}
          </Button>
        </div>
      )}
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-black/30 border border-white/5 rounded-lg p-2.5">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-xs font-medium text-white truncate">{value}</p>
    </div>
  );
}
