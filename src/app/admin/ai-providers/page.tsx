'use client';

import { useEffect, useState } from 'react';
import { getAdminAIProviders, updateAdminAIProvider, type AdminAIProvider } from '@/lib/admin-api';
import { useToast } from '@/components/ui/Toast';
import { RefreshIcon, CheckCircleIcon, AlertIcon } from '@/components/ui/icons';

const PROVIDER_BRANDING: Record<string, { color: string; bg: string; gradient: string; description: string; getKeyUrl: string }> = {
  openai: {
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    gradient: 'from-emerald-500/20 to-emerald-500/0',
    description: 'GPT-4o, GPT-4 Turbo. Industry standard. Pay per token.',
    getKeyUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    gradient: 'from-orange-500/20 to-orange-500/0',
    description: 'Claude 3.5 Sonnet, Haiku, Opus. Best for nuanced reasoning.',
    getKeyUrl: 'https://console.anthropic.com/settings/keys',
  },
  google: {
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    gradient: 'from-blue-500/20 to-blue-500/0',
    description: 'Gemini 2.0 Flash, 1.5 Pro. Generous free tier.',
    getKeyUrl: 'https://aistudio.google.com/app/apikey',
  },
  groq: {
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    gradient: 'from-cyan-500/20 to-cyan-500/0',
    description: 'Llama 3.3, Mixtral, DeepSeek. Free tier, ultra-fast inference.',
    getKeyUrl: 'https://console.groq.com/keys',
  },
};

export default function AdminAIProvidersPage() {
  const toast = useToast();
  const [providers, setProviders] = useState<AdminAIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftKey, setDraftKey] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getAdminAIProviders();
      setProviders(res.providers);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEdit = (provider: AdminAIProvider) => {
    setEditing(provider.provider);
    setDraftKey('');
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraftKey('');
  };

  const saveKey = async (provider: AdminAIProvider) => {
    if (!draftKey.trim()) {
      toast.error('API key is required');
      return;
    }
    try {
      setSaving(true);
      await updateAdminAIProvider(provider.provider, {
        apiKey: draftKey.trim(),
        isActive: true,
      });
      toast.success(`${provider.displayName} configured successfully`);
      setEditing(null);
      setDraftKey('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (provider: AdminAIProvider) => {
    if (!provider.apiKey || provider.apiKey === '') {
      toast.error('Set an API key first');
      return;
    }
    try {
      await updateAdminAIProvider(provider.provider, { isActive: !provider.isActive });
      toast.success(`${provider.displayName} ${!provider.isActive ? 'enabled' : 'disabled'}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to toggle');
    }
  };

  const removeKey = async (provider: AdminAIProvider) => {
    if (!confirm(`Remove API key for ${provider.displayName}?`)) return;
    try {
      await updateAdminAIProvider(provider.provider, { apiKey: '', isActive: false });
      toast.success(`${provider.displayName} key removed`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove');
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
            AI Providers
          </h1>
          <p className="text-sm text-zinc-400">
            Manage API keys for the AI models powering your agents. Keys are stored encrypted on the server.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 text-zinc-400 hover:text-white bg-zinc-900/60 border border-white/10 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats summary */}
      {!loading && providers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Total</p>
            <p className="text-2xl font-bold text-white">{providers.length}</p>
          </div>
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4">
            <p className="text-[10px] text-emerald-400/80 uppercase tracking-wider mb-1">Active</p>
            <p className="text-2xl font-bold text-emerald-400">
              {providers.filter((p) => p.isActive && p.apiKey).length}
            </p>
          </div>
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4">
            <p className="text-[10px] text-blue-400/80 uppercase tracking-wider mb-1">Configured</p>
            <p className="text-2xl font-bold text-blue-400">
              {providers.filter((p) => !!p.apiKey).length}
            </p>
          </div>
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Empty</p>
            <p className="text-2xl font-bold text-zinc-400">
              {providers.filter((p) => !p.apiKey).length}
            </p>
          </div>
        </div>
      )}

      {/* Providers list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-zinc-900/60 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map((provider) => {
            const branding = PROVIDER_BRANDING[provider.provider] || {
              color: 'text-zinc-400',
              bg: 'bg-white/5',
              gradient: 'from-white/[0.04] to-white/0',
              description: '',
              getKeyUrl: '',
            };
            const isEditing = editing === provider.provider;
            const hasKey = !!provider.apiKey;

            return (
              <div
                key={provider.id}
                className={`relative bg-gradient-to-br ${branding.gradient} bg-zinc-900/50 border ${
                  provider.isActive ? 'border-emerald-500/30' : 'border-white/10'
                } rounded-xl p-5 transition-colors`}
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`w-10 h-10 rounded-lg ${branding.bg} ${branding.color} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-sm font-bold uppercase">{provider.provider.slice(0, 2)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-base font-semibold text-white">{provider.displayName}</h3>
                        {provider.isActive && hasKey ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircleIcon className="w-3 h-3" /> Active
                          </span>
                        ) : hasKey ? (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-500/10 text-zinc-400 border border-white/10">
                            Configured (off)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                            <AlertIcon className="w-3 h-3" /> No key
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500">{branding.description}</p>
                    </div>
                  </div>

                  {/* Active toggle (only if has key) */}
                  {hasKey && !isEditing && (
                    <button
                      onClick={() => toggleActive(provider)}
                      className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${
                        provider.isActive ? 'bg-emerald-500' : 'bg-white/10'
                      }`}
                      title={provider.isActive ? 'Disable' : 'Enable'}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                          provider.isActive ? 'translate-x-4' : ''
                        }`}
                      />
                    </button>
                  )}
                </div>

                {/* Models pills */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {provider.models.map((model) => (
                    <span
                      key={model}
                      className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/5"
                    >
                      {model}
                    </span>
                  ))}
                </div>

                {/* API Key row */}
                {isEditing ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        value={draftKey}
                        onChange={(e) => setDraftKey(e.target.value)}
                        placeholder={`Paste your ${provider.displayName} API key…`}
                        className="flex-1 px-3 py-2 bg-black/60 border border-white/10 focus:border-white/40 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => saveKey(provider)}
                        disabled={saving}
                        className="px-4 py-2 bg-white text-black rounded-lg text-xs font-semibold hover:bg-zinc-200 disabled:opacity-50 transition-colors"
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-2 text-zinc-400 hover:text-white text-xs transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                    {branding.getKeyUrl && (
                      <p className="text-[11px] text-zinc-600">
                        Get a key from{' '}
                        <a
                          href={branding.getKeyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${branding.color} hover:underline`}
                        >
                          {branding.getKeyUrl.replace('https://', '')}
                        </a>
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0 text-xs text-zinc-500">
                      {hasKey ? (
                        <span className="font-mono">key {provider.apiKey}</span>
                      ) : (
                        <span>No API key set</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {hasKey && (
                        <button
                          onClick={() => removeKey(provider)}
                          className="text-[11px] text-zinc-500 hover:text-red-400 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                      <button
                        onClick={() => startEdit(provider)}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white transition-colors"
                      >
                        {hasKey ? 'Replace key' : 'Set API key'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Help */}
      <div className="mt-8 bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
        <p className="text-xs text-blue-400/80">
          💡 <span className="text-blue-300 font-medium">Tip:</span> Keys are shared across all users. Once a provider is active,
          all users can select its models when creating an agent. <strong>Groq</strong> is the cheapest option (free tier with
          ultra-fast inference).
        </p>
      </div>
    </>
  );
}
