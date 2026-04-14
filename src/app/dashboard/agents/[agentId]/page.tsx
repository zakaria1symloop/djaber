'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, Badge } from '@/components/ui';
import {
  BotIcon, ChevronLeftIcon, ChatIcon, EditIcon, AlertIcon,
  CheckCircleIcon, ClockIcon, ShoppingCartIcon, MessageIcon,
  FacebookIcon, CloseIcon, BanIcon,
} from '@/components/ui/icons';
import {
  getAgentApi, getAgentMetrics, getAgentInsights, resolveAgentInsight, updateAgentApi,
  type Agent, type AgentMetrics, type AgentInsight,
} from '@/lib/user-stock-api';

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.agentId as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);
  const [insights, setInsights] = useState<AgentInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [insightsFilter, setInsightsFilter] = useState<'pending' | 'resolved' | 'dismissed' | ''>('pending');

  // Resolve insight state
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [newInstruction, setNewInstruction] = useState('');
  const [saving, setSaving] = useState(false);

  // Instructions edit
  const [editingInstructions, setEditingInstructions] = useState(false);
  const [instructionsText, setInstructionsText] = useState('');
  const [savingInstructions, setSavingInstructions] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [agentRes, metricsRes, insightsRes] = await Promise.all([
        getAgentApi(agentId),
        getAgentMetrics(agentId),
        getAgentInsights(agentId, insightsFilter || undefined),
      ]);
      setAgent(agentRes.agent);
      setMetrics(metricsRes.metrics);
      setInsights(insightsRes.insights);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [agentId, insightsFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleResolve = async (insightId: string, action: 'resolve' | 'dismiss') => {
    setSaving(true);
    try {
      await resolveAgentInsight(insightId, {
        action,
        newInstruction: action === 'resolve' ? newInstruction.trim() || undefined : undefined,
      });
      setResolvingId(null);
      setNewInstruction('');
      loadData();
    } catch {
      // handled
    } finally {
      setSaving(false);
    }
  };

  const handleSaveInstructions = async () => {
    if (!agent) return;
    setSavingInstructions(true);
    try {
      const res = await updateAgentApi(agentId, { customInstructions: instructionsText });
      setAgent(res.agent);
      setEditingInstructions(false);
    } catch {
      // handled
    } finally {
      setSavingInstructions(false);
    }
  };

  if (loading && !agent) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="text-center py-16 text-zinc-400">
        Agent not found.
        <Button variant="ghost" className="ml-2" onClick={() => router.push('/dashboard/agents')}>Go back</Button>
      </div>
    );
  }

  const personalityColors: Record<string, string> = {
    professional: 'bg-blue-500/20 text-blue-400',
    friendly: 'bg-emerald-500/20 text-emerald-400',
    casual: 'bg-amber-500/20 text-amber-400',
    technical: 'bg-violet-500/20 text-violet-400',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/dashboard/agents')}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5 text-zinc-400" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <BotIcon className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{agent.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-xs px-2 py-0.5 rounded-full ${personalityColors[agent.personality] || 'bg-zinc-700 text-zinc-300'}`}>
                  {agent.personality}
                </span>
                <span className="text-xs text-zinc-500">{agent.aiModel}</span>
                <Badge variant={agent.isActive ? 'success' : 'default'}>
                  {agent.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => router.push(`/dashboard/agents/${agentId}/edit`)}
        >
          <EditIcon className="w-4 h-4 mr-1.5" />
          Edit Agent
        </Button>
      </div>

      {/* KPI Cards */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <ChatIcon className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-zinc-500">Conversations</span>
            </div>
            <p className="text-2xl font-bold text-white">{metrics.conversationCount}</p>
            <p className="text-[10px] text-zinc-600 mt-1">{metrics.messagesFromCustomers} received · {metrics.messagesFromAgent} sent</p>
          </div>
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageIcon className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-zinc-500">Total Messages</span>
            </div>
            <p className="text-2xl font-bold text-white">{metrics.totalMessages}</p>
            <p className="text-[10px] text-zinc-600 mt-1">
              {metrics.lastActiveDate ? `Last: ${new Date(metrics.lastActiveDate).toLocaleDateString()}` : 'No activity yet'}
            </p>
          </div>
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCartIcon className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-zinc-500">Orders Created</span>
            </div>
            <p className="text-2xl font-bold text-white">{metrics.ordersCreated}</p>
          </div>
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertIcon className="w-4 h-4 text-red-400" />
              <span className="text-xs text-zinc-500">Pending Issues</span>
            </div>
            <p className="text-2xl font-bold text-white">{metrics.insightsPending}</p>
            <p className="text-[10px] text-zinc-600 mt-1">{metrics.insightsResolved} resolved</p>
          </div>
        </div>
      )}

      {/* Insights Section */}
      <div className="bg-zinc-900 border border-white/10 rounded-xl">
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertIcon className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">Agent Insights</h2>
              {metrics && metrics.insightsPending > 0 && (
                <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">{metrics.insightsPending} pending</span>
              )}
            </div>
            <div className="flex gap-1">
              {(['pending', 'resolved', 'dismissed'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setInsightsFilter(insightsFilter === f ? '' : f)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg transition-colors ${
                    insightsFilter === f ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {insights.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-sm">
            {insightsFilter === 'pending' ? 'No pending issues — your agent is handling everything well!' : 'No insights found.'}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {insights.map(insight => (
              <div key={insight.id} className="p-4">
                <div className="flex items-start gap-3">
                  {/* Type badge */}
                  <div className={`flex-shrink-0 mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center ${
                    insight.type === 'unclear' ? 'bg-amber-500/20' : 'bg-red-500/20'
                  }`}>
                    {insight.type === 'unclear' ? (
                      <AlertIcon className="w-4 h-4 text-amber-400" />
                    ) : (
                      <BanIcon className="w-4 h-4 text-red-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={insight.type === 'unclear' ? 'warning' : 'error'}>
                        {insight.type === 'unclear' ? 'Unclear' : 'Unknown Topic'}
                      </Badge>
                      <FacebookIcon className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-[10px] text-zinc-600 ml-auto">
                        {new Date(insight.createdAt).toLocaleDateString()} {new Date(insight.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Detail/reason */}
                    {insight.detail && (
                      <p className="text-xs text-amber-400/80 mb-2 italic">{insight.detail}</p>
                    )}

                    {/* Customer message */}
                    <div className="bg-zinc-800/50 rounded-lg p-2.5 mb-2">
                      <p className="text-[10px] text-zinc-500 mb-0.5">Customer:</p>
                      <p className="text-xs text-zinc-300">{insight.customerMessage}</p>
                    </div>

                    {/* AI response */}
                    <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-2.5 mb-2">
                      <p className="text-[10px] text-zinc-500 mb-0.5">AI Response:</p>
                      <p className="text-xs text-zinc-400">{insight.aiResponse.slice(0, 200)}{insight.aiResponse.length > 200 ? '...' : ''}</p>
                    </div>

                    {/* Actions */}
                    {insight.status === 'pending' && (
                      resolvingId === insight.id ? (
                        <div className="space-y-2 mt-3">
                          <textarea
                            value={newInstruction}
                            onChange={(e) => setNewInstruction(e.target.value)}
                            placeholder="Add an instruction so the agent handles this better next time... (e.g., 'When customers ask about delivery time, say 2-3 business days')"
                            className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleResolve(insight.id, 'resolve')}
                              disabled={saving}
                            >
                              <CheckCircleIcon className="w-3.5 h-3.5 mr-1" />
                              {newInstruction.trim() ? 'Add Instruction & Resolve' : 'Resolve'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setResolvingId(null); setNewInstruction(''); }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 mt-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setResolvingId(insight.id)}
                          >
                            <CheckCircleIcon className="w-3.5 h-3.5 mr-1" />
                            Resolve
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResolve(insight.id, 'dismiss')}
                            disabled={saving}
                          >
                            <CloseIcon className="w-3.5 h-3.5 mr-1" />
                            Dismiss
                          </Button>
                        </div>
                      )
                    )}

                    {insight.status !== 'pending' && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <Badge variant={insight.status === 'resolved' ? 'success' : 'default'}>
                          {insight.status}
                        </Badge>
                        {insight.resolvedAt && (
                          <span className="text-[10px] text-zinc-600">
                            {new Date(insight.resolvedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Current Instructions */}
      <div className="bg-zinc-900 border border-white/10 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Custom Instructions</h2>
          {!editingInstructions ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setInstructionsText(agent.customInstructions || '');
                setEditingInstructions(true);
              }}
            >
              <EditIcon className="w-3.5 h-3.5 mr-1" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveInstructions}
                disabled={savingInstructions}
              >
                {savingInstructions ? 'Saving...' : 'Save'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingInstructions(false)}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>

        {editingInstructions ? (
          <textarea
            value={instructionsText}
            onChange={(e) => setInstructionsText(e.target.value)}
            className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none min-h-[120px]"
            placeholder="Add instructions for your agent..."
          />
        ) : agent.customInstructions ? (
          <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-sans leading-relaxed bg-zinc-800/50 rounded-lg p-3">
            {agent.customInstructions}
          </pre>
        ) : (
          <p className="text-sm text-zinc-600 italic">No custom instructions set. The agent uses default behavior.</p>
        )}
      </div>
    </div>
  );
}
