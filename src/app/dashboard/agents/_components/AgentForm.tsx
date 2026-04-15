'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Badge } from '@/components/ui';
import {
  BotIcon,
  ChevronLeftIcon,
  BoxIcon,
  SearchIcon,
  CheckCircleIcon,
} from '@/components/ui/icons';
import { usePages } from '@/contexts/PagesContext';
import {
  getAgentApi,
  createAgent,
  updateAgentApi,
  getProducts,
  getActiveAIProviders,
  type Agent,
  type Product,
  type ActiveProvider,
} from '@/lib/user-stock-api';

const personalities = [
  { value: 'professional', label: 'Professional', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', desc: 'Formal and business-focused' },
  { value: 'friendly', label: 'Friendly', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', desc: 'Warm and approachable' },
  { value: 'casual', label: 'Casual', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', desc: 'Relaxed and conversational' },
  { value: 'technical', label: 'Technical', color: 'bg-violet-500/20 text-violet-400 border-violet-500/30', desc: 'Detailed and precise' },
];

// Provider display config (color mapping)
const providerColors: Record<string, string> = {
  openai: 'text-emerald-400',
  anthropic: 'text-orange-400',
  google: 'text-blue-400',
  groq: 'text-cyan-400',
};

// Friendly model labels
const modelLabels: Record<string, { label: string; desc: string }> = {
  'gpt-4o': { label: 'GPT-4o', desc: 'Best quality' },
  'gpt-4o-mini': { label: 'GPT-4o Mini', desc: 'Fast & affordable' },
  'gpt-4-turbo': { label: 'GPT-4 Turbo', desc: '128k context' },
  'gpt-3.5-turbo': { label: 'GPT-3.5 Turbo', desc: 'Legacy, fast' },
  'claude-3-5-sonnet-20241022': { label: 'Claude 3.5 Sonnet', desc: 'Best balanced' },
  'claude-3-5-haiku-20241022': { label: 'Claude 3.5 Haiku', desc: 'Fast & cheap' },
  'claude-3-opus-20240229': { label: 'Claude 3 Opus', desc: 'Most capable' },
  'gemini-2.0-flash': { label: 'Gemini 2.0 Flash', desc: 'Latest, fast' },
  'gemini-1.5-pro': { label: 'Gemini 1.5 Pro', desc: '1M context' },
  'gemini-1.5-flash': { label: 'Gemini 1.5 Flash', desc: 'Fast & affordable' },
  'llama-3.3-70b-versatile': { label: 'Llama 3.3 70B', desc: 'Best open-source' },
  'llama-3.1-8b-instant': { label: 'Llama 3.1 8B', desc: 'Ultra fast' },
  'mixtral-8x7b-32768': { label: 'Mixtral 8x7B', desc: 'MoE, 32k context' },
  'deepseek-r1-distill-llama-70b': { label: 'DeepSeek R1 70B', desc: 'Reasoning model' },
};

interface AgentFormProps {
  agentId?: string;
}

export default function AgentForm({ agentId }: AgentFormProps) {
  const router = useRouter();
  const { pages } = usePages();
  const isEdit = !!agentId;

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [personality, setPersonality] = useState('professional');
  const [customInstructions, setCustomInstructions] = useState('');
  const [productTemplate, setProductTemplate] = useState('');
  const [closingInstructions, setClosingInstructions] = useState('');
  const [responseDelay, setResponseDelay] = useState(3);
  const templateRef = useRef<HTMLTextAreaElement>(null);
  const [aiModel, setAiModel] = useState('gpt-4o-mini');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [sellAllProducts, setSellAllProducts] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Data state
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [activeProviders, setActiveProviders] = useState<ActiveProvider[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingAgent, setLoadingAgent] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load agent data for editing
  useEffect(() => {
    if (!agentId) return;
    (async () => {
      try {
        setLoadingAgent(true);
        const { agent } = await getAgentApi(agentId);
        setName(agent.name);
        setDescription(agent.description || '');
        setPersonality(agent.personality);
        setCustomInstructions(agent.customInstructions || '');
        setProductTemplate(agent.productTemplate || '');
        setClosingInstructions(agent.closingInstructions || '');
        setResponseDelay(agent.responseDelay ?? 3);
        setAiModel(agent.aiModel);
        setTemperature(agent.temperature);
        setMaxTokens(agent.maxTokens);
        setSellAllProducts(agent.sellAllProducts);
        setIsActive(agent.isActive);
        setSelectedPageIds(agent.pages.map((ap) => ap.pageId));
        setSelectedProductIds(agent.products.map((ap) => ap.productId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load agent');
      } finally {
        setLoadingAgent(false);
      }
    })();
  }, [agentId]);

  // Load products + active AI providers
  useEffect(() => {
    (async () => {
      try {
        setLoadingProducts(true);
        const [prodRes, provRes] = await Promise.all([
          getProducts({ limit: 200 }),
          getActiveAIProviders(),
        ]);
        setProducts(prodRes.products);
        setActiveProviders(provRes.providers);
      } catch {
        // silently fail
      } finally {
        setLoadingProducts(false);
      }
    })();
  }, []);

  const togglePage = (pageId: string) => {
    setSelectedPageIds((prev) =>
      prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]
    );
  };

  const toggleProduct = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const filteredProducts = products.filter((p) =>
    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Agent name is required');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        personality,
        customInstructions: customInstructions.trim() || undefined,
        productTemplate: productTemplate.trim() || undefined,
        closingInstructions: closingInstructions.trim() || undefined,
        responseDelay,
        aiModel,
        temperature,
        maxTokens,
        sellAllProducts,
        isActive,
        pageIds: selectedPageIds,
        productIds: sellAllProducts ? [] : selectedProductIds,
      };

      if (isEdit) {
        await updateAgentApi(agentId, payload);
      } else {
        await createAgent(payload);
      }

      router.push('/dashboard/agents');
    } catch (err: any) {
      setError(err?.message || 'Failed to save agent');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  if (loadingAgent) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-zinc-800 rounded w-48" />
          <div className="h-64 bg-zinc-800 rounded-xl" />
          <div className="h-48 bg-zinc-800 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/dashboard/agents')}
          className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
            {isEdit ? 'Edit Agent' : 'Create Agent'}
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {isEdit ? 'Update your AI agent configuration' : 'Set up a new AI agent to handle conversations'}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline text-xs">dismiss</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <section className="bg-zinc-900/50 border border-white/10 rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Basic Information</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Agent Name *</label>
              <div className="relative">
                <BotIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sales Assistant"
                  className="w-full bg-black/50 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:border-white/30 focus:outline-none transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe what this agent does..."
                rows={2}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:border-white/30 focus:outline-none transition-colors resize-none"
              />
            </div>

            {/* Active Toggle */}
            {isEdit && (
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-zinc-300">Active</p>
                  <p className="text-xs text-zinc-500">Agent will respond to messages when active</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    isActive ? 'bg-emerald-500' : 'bg-zinc-700'
                  }`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    isActive ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Personality */}
        <section className="bg-zinc-900/50 border border-white/10 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Personality</h2>
          <div className="grid grid-cols-2 gap-3">
            {personalities.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPersonality(p.value)}
                className={`relative p-4 rounded-xl border text-left transition-all ${
                  personality === p.value
                    ? `${p.color} border-current`
                    : 'bg-black/30 border-white/10 text-zinc-400 hover:border-white/20'
                }`}
              >
                {personality === p.value && (
                  <CheckCircleIcon className="absolute top-3 right-3 w-4 h-4" />
                )}
                <p className="font-medium text-sm">{p.label}</p>
                <p className={`text-xs mt-0.5 ${personality === p.value ? 'opacity-80' : 'text-zinc-500'}`}>
                  {p.desc}
                </p>
              </button>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Custom Instructions</label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="Add specific instructions for how the agent should behave, respond, or handle certain scenarios..."
              rows={4}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:border-white/30 focus:outline-none transition-colors resize-none"
            />
            <p className="text-xs text-zinc-500 mt-1">
              These instructions will guide the agent&apos;s behavior in conversations.
            </p>
          </div>

          {/* Closing Instructions */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Conversation Closing</label>
            <textarea
              value={closingInstructions}
              onChange={(e) => setClosingInstructions(e.target.value)}
              placeholder={`Examples:\n• After order is confirmed: "Thank you! Order #{number} is on its way. Have a great day! 🎉"\n• When customer says bye: "Thanks for chatting! Come back anytime 😊"\n• After 3 unanswered questions: "I'll connect you with our team for more help."\n• If customer is angry: "I'm sorry for the inconvenience. Let me get a human to help you right away."`}
              rows={5}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:border-white/30 focus:outline-none transition-colors resize-none"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Tell the AI when and how to close conversations. If empty, it uses sensible defaults (thank after order, respond to goodbye, etc).
            </p>
          </div>
        </section>

        {/* Product Display Template */}
        <section className="bg-zinc-900/50 border border-white/10 rounded-xl p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-1">Product Display Template</h2>
            <p className="text-xs text-zinc-500">
              Define how the AI presents products. Leave empty for the default style. The AI will follow this format exactly.
            </p>
          </div>

          <div>
            <p className="text-[11px] text-zinc-500 mb-2">
              Click a tag to insert it. Type your own text around them. The AI fills in real product data automatically.
            </p>

            {/* Clickable tag chips */}
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                { tag: '[PRODUCT_CARD]', label: '🖼 Product Image Card', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' },
                { tag: '{name}', label: 'Product Name', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20' },
                { tag: '{price}', label: 'Price (DA)', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20' },
                { tag: '{description}', label: 'Description', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20 hover:bg-violet-500/20' },
                { tag: '{stock}', label: 'Stock Qty', color: 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10' },
                { tag: '\\n', label: '↵ New Line', color: 'bg-white/5 text-zinc-500 border-white/10 hover:bg-white/10' },
              ].map((chip) => (
                <button
                  key={chip.tag}
                  type="button"
                  onClick={() => {
                    const ta = templateRef.current;
                    if (!ta) return;
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const insert = chip.tag === '\\n' ? '\n' : chip.tag;
                    const before = productTemplate.slice(0, start);
                    const after = productTemplate.slice(end);
                    const newVal = before + insert + after;
                    setProductTemplate(newVal);
                    // Restore cursor after the inserted tag
                    setTimeout(() => {
                      ta.focus();
                      const pos = start + insert.length;
                      ta.setSelectionRange(pos, pos);
                    }, 0);
                  }}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border cursor-pointer transition-colors ${chip.color}`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Template textarea */}
            <textarea
              ref={templateRef}
              value={productTemplate}
              onChange={(e) => setProductTemplate(e.target.value)}
              placeholder={`Click the tags above or type here...\n\nExample:\nHere's what I found! 😊\n[PRODUCT_CARD]\nOnly {price} DA — want to order?`}
              rows={6}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:border-white/30 focus:outline-none transition-colors resize-none"
            />
          </div>

          {/* Live preview */}
          <div>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Preview</p>
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
              {/* Customer */}
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-[10px] font-semibold text-zinc-300 flex-shrink-0">C</div>
                <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-3 py-2 max-w-[75%]">
                  <p className="text-sm text-zinc-200">Show me your products</p>
                </div>
              </div>

              {/* Agent response based on template */}
              <div className="flex gap-2 flex-row-reverse">
                <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <BotIcon className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="max-w-[80%] space-y-2">
                  {(() => {
                    const sampleProduct = products.find((p) => sellAllProducts || selectedProductIds.includes(p.id));
                    const sampleName = sampleProduct?.name || 'Sample Product';
                    const samplePrice = sampleProduct ? Number(sampleProduct.sellingPrice).toLocaleString() : '1,500';
                    const sampleDesc = sampleProduct?.description || 'A great product';

                    const template = productTemplate.trim() || `Here's what we have! 😊\n[PRODUCT_CARD:id]\nWould you like to order?`;

                    // Replace variables for preview
                    const previewText = template
                      .replace(/\{name\}/g, sampleName)
                      .replace(/\{price\}/g, samplePrice)
                      .replace(/\{description\}/g, sampleDesc);

                    // Split on [PRODUCT_CARD:...] tags
                    const parts = previewText.split(/\[PRODUCT_CARD:[^\]]*\]/);
                    const hasCard = /\[PRODUCT_CARD:/.test(previewText);

                    return (
                      <>
                        {parts.map((part, i) => (
                          <div key={i}>
                            {part.trim() && (
                              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl rounded-tr-sm px-3 py-2">
                                <p className="text-sm text-zinc-100 whitespace-pre-wrap">{part.trim()}</p>
                              </div>
                            )}
                            {hasCard && i < parts.length - 1 && (
                              <div className="w-52 bg-zinc-900/80 border border-white/10 rounded-xl overflow-hidden mt-2">
                                <div className="w-full h-24 bg-zinc-800 flex items-center justify-center">
                                  {sampleProduct?.imageUrl ? (
                                    <img src={sampleProduct.imageUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <BoxIcon className="w-8 h-8 text-zinc-600" />
                                  )}
                                </div>
                                <div className="p-3">
                                  <p className="text-sm font-medium text-white truncate">{sampleName}</p>
                                  <p className="text-xs text-emerald-400 mt-0.5">{samplePrice} DA</p>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="flex items-center justify-center pt-1">
                <span className="text-[10px] uppercase tracking-wider text-zinc-600 bg-black/60 px-3 py-1 rounded-full border border-white/5">
                  Live preview
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* AI Model Config */}
        <section className="bg-zinc-900/50 border border-white/10 rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">AI Model Configuration</h2>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-3">Model</label>
            {activeProviders.length > 0 ? (
              <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                {activeProviders.map((group) => (
                  <div key={group.provider}>
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${providerColors[group.provider] || 'text-zinc-400'}`}>
                      {group.displayName}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {group.models.map((modelId) => {
                        const info = modelLabels[modelId] || { label: modelId, desc: '' };
                        return (
                          <button
                            key={modelId}
                            type="button"
                            onClick={() => setAiModel(modelId)}
                            className={`p-2.5 rounded-lg border text-left transition-all ${
                              aiModel === modelId
                                ? 'bg-white/10 border-white/30 text-white'
                                : 'bg-black/30 border-white/5 text-zinc-400 hover:border-white/15'
                            }`}
                          >
                            <p className="font-medium text-sm">{info.label}</p>
                            {info.desc && <p className="text-xs text-zinc-500 mt-0.5">{info.desc}</p>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : loadingProducts ? (
              <div className="text-center py-4 text-sm text-zinc-500">
                Loading available models...
              </div>
            ) : (
              <div className="text-center py-4 text-sm text-zinc-500">
                No AI providers configured. Ask your admin to set up AI providers.
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-zinc-300">Temperature</label>
              <span className="text-sm font-mono text-zinc-400">{temperature.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-white h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <div className="flex justify-between text-xs text-zinc-600 mt-1">
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Max Tokens</label>
            <input
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(Math.max(100, Math.min(4096, parseInt(e.target.value) || 1024)))}
              min={100}
              max={4096}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-white/30 focus:outline-none transition-colors"
            />
            <p className="text-xs text-zinc-500 mt-1">Maximum response length (100-4096)</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-zinc-300">Response Delay</label>
              <span className="text-sm font-mono text-zinc-400">{responseDelay}s</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={responseDelay}
              onChange={(e) => setResponseDelay(parseInt(e.target.value))}
              className="w-full accent-white h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
              <span>Instant</span>
              <span>Wait 10s</span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Wait for more messages before responding. People often send multiple short messages — this combines them into one.
            </p>
          </div>
        </section>

        {/* Connected Pages */}
        <section className="bg-zinc-900/50 border border-white/10 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Connected Pages</h2>
          <p className="text-xs text-zinc-500">Select which pages this agent will respond on. Each page can only have one agent.</p>

          {pages.length > 0 ? (
            <div className="space-y-2">
              {pages.map((page) => {
                const isSelected = selectedPageIds.includes(page.id);
                return (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => togglePage(page.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                        : 'bg-black/30 border-white/10 text-zinc-400 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        isSelected ? 'bg-blue-500/20' : 'bg-zinc-800'
                      }`}>
                        {page.pageName.charAt(0).toUpperCase()}
                      </div>
                      <div className="text-left">
                        <p className={`text-sm font-medium ${isSelected ? 'text-white' : ''}`}>{page.pageName}</p>
                        <p className="text-xs text-zinc-500">{page.platform}</p>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-blue-500 border-blue-500'
                        : 'border-zinc-600'
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-zinc-500">No connected pages yet.</p>
              <p className="text-xs text-zinc-600 mt-1">Connect a Facebook page first in Social Media settings.</p>
            </div>
          )}
        </section>

        {/* Products */}
        <section className="bg-zinc-900/50 border border-white/10 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Product Knowledge</h2>

          {/* Sell All Toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-zinc-300">Sell All Products</p>
              <p className="text-xs text-zinc-500">Agent knows your entire product catalog</p>
            </div>
            <button
              type="button"
              onClick={() => setSellAllProducts(!sellAllProducts)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                sellAllProducts ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                sellAllProducts ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Product Selection (when not selling all) */}
          {!sellAllProducts && (
            <div className="space-y-3">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search products..."
                  className="w-full bg-black/50 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white text-sm placeholder-zinc-600 focus:border-white/30 focus:outline-none transition-colors"
                />
              </div>

              {selectedProductIds.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span>{selectedProductIds.length} product{selectedProductIds.length > 1 ? 's' : ''} selected</span>
                  <button
                    type="button"
                    onClick={() => setSelectedProductIds([])}
                    className="text-red-400 hover:text-red-300 underline"
                  >
                    clear
                  </button>
                </div>
              )}

              <div className="max-h-64 overflow-y-auto space-y-1.5 scrollbar-thin">
                {loadingProducts ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse h-12 bg-zinc-800 rounded-lg" />
                    ))}
                  </div>
                ) : filteredProducts.length > 0 ? (
                  filteredProducts.map((product) => {
                    const isSelected = selectedProductIds.includes(product.id);
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => toggleProduct(product.id)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-emerald-500/10 border-emerald-500/30'
                            : 'bg-black/30 border-white/5 hover:border-white/15'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-8 h-8 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                              <BoxIcon className="w-4 h-4 text-zinc-600" />
                            </div>
                          )}
                          <div className="text-left">
                            <p className={`text-sm ${isSelected ? 'text-white' : 'text-zinc-300'}`}>{product.name}</p>
                            <p className="text-xs text-zinc-500">{product.sku} &middot; {product.sellingPrice.toLocaleString()} DA</p>
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'border-zinc-600'
                        }`}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-zinc-500">
                      {productSearch ? 'No products match your search' : 'No products available'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 pb-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/dashboard/agents')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={saving}
            icon={isEdit ? undefined : <BotIcon className="w-4 h-4" />}
          >
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Agent'}
          </Button>
        </div>
      </form>
    </div>
  );
}
