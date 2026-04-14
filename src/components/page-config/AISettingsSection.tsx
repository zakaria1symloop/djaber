'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button } from '@/components/ui';
import { BotIcon, EditIcon, AlertIcon } from '@/components/ui/icons';

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
      if (!res.ok) throw new Error('Failed to load agents');
      const data = await res.json();
      const linked = data.agents?.find((a: any) =>
        a.pages?.some((ap: any) => ap.pageId === pageId || ap.page?.id === pageId)
      );
      setAgent(linked || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent');
    } finally {
      setLoading(false);
    }
  };

  const personalityLabels: Record<string, { label: string; color: string }> = {
    professional: { label: 'Professional', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    friendly: { label: 'Friendly', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    casual: { label: 'Casual', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    technical: { label: 'Technical', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
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
        <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>AI Settings</h2>
        <p className="text-xs text-zinc-500 mt-0.5">AI agent configuration for this page</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
          {error}
          <button onClick={loadAgent} className="ml-2 underline text-xs">Retry</button>
        </div>
      )}

      {agent ? (
        <div className="space-y-4">
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                  agent.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-500/10 text-zinc-400'
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
                    <Badge variant={agent.isActive ? 'success' : 'default'} size="sm">
                      {agent.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                icon={<EditIcon className="w-3.5 h-3.5" />}
                onClick={() => router.push(`/dashboard/agents/${agent.id}`)}
              >
                Edit
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <InfoTile label="Model" value={agent.aiModel} />
              <InfoTile label="Temperature" value={agent.temperature.toFixed(1)} />
              <InfoTile label="Max Tokens" value={agent.maxTokens.toString()} />
              <InfoTile label="Products" value={agent.sellAllProducts ? 'All' : `${agent._count.products} selected`} />
            </div>

            {agent.customInstructions && (
              <div>
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Custom Instructions</p>
                <div className="bg-black/40 border border-white/5 rounded-lg p-3">
                  <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">{agent.customInstructions}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5 text-xs text-zinc-500">
              <span>{agent._count.pages} page{agent._count.pages !== 1 ? 's' : ''} linked</span>
              <span>·</span>
              <span>{agent._count.conversations} conversation{agent._count.conversations !== 1 ? 's' : ''}</span>
            </div>
          </div>

          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3">
            <p className="text-xs text-blue-400/80">
              To change how the AI responds, edit the agent&apos;s personality, model, or custom instructions. Changes apply to all pages linked to this agent.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-8 text-center">
          <div className="w-14 h-14 rounded-xl bg-yellow-500/10 text-yellow-400 flex items-center justify-center mx-auto mb-3">
            <AlertIcon className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">No AI Agent Linked</h3>
          <p className="text-xs text-zinc-400 mb-4 max-w-md mx-auto">
            This page doesn&apos;t have an AI agent assigned. Create or link an agent so it can automatically respond to incoming messages.
          </p>
          <Button
            onClick={() => router.push('/dashboard/agents')}
            icon={<BotIcon className="w-4 h-4" />}
          >
            Go to Agents
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
