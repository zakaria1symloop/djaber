'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui';
import { getAgentTemplate } from '@/lib/agent-templates';
import { costPer1000Label } from '@/lib/model-pricing';
import {
  BotIcon,
  ChevronLeftIcon,
  BoxIcon,
  SearchIcon,
  CheckCircleIcon,
  FacebookIcon,
  InstagramIcon,
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
import { useTranslation } from '@/contexts/LanguageContext';

const personalities = [
  { value: 'professional', labelKey: 'aiSettings.personality.professional', descKey: 'shell.form.pers.professionalDesc' },
  { value: 'friendly', labelKey: 'aiSettings.personality.friendly', descKey: 'shell.form.pers.friendlyDesc' },
  { value: 'casual', labelKey: 'aiSettings.personality.casual', descKey: 'shell.form.pers.casualDesc' },
  { value: 'technical', labelKey: 'aiSettings.personality.technical', descKey: 'shell.form.pers.technicalDesc' },
];

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
  const { t, dir } = useTranslation();
  const searchParams = useSearchParams();
  const { pages } = usePages();
  const isEdit = !!agentId;
  const templateKey = !agentId ? searchParams.get('template') : null;
  const [appliedTemplate, setAppliedTemplate] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [personality, setPersonality] = useState('professional');
  const [customInstructions, setCustomInstructions] = useState('');
  const [productTemplate, setProductTemplate] = useState('');
  const [closingInstructions, setClosingInstructions] = useState('');
  const [humanHandoffRules, setHumanHandoffRules] = useState('');
  const [imageRecognition, setImageRecognition] = useState(false);
  const [voiceTranscription, setVoiceTranscription] = useState(false);
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
        setHumanHandoffRules(agent.humanHandoffRules || '');
        setImageRecognition(agent.imageRecognition ?? false);
        setVoiceTranscription((agent as Agent & { voiceTranscription?: boolean }).voiceTranscription ?? false);
        setResponseDelay(agent.responseDelay ?? 3);
        setAiModel(agent.aiModel);
        setTemperature(agent.temperature);
        setMaxTokens(agent.maxTokens);
        setSellAllProducts(agent.sellAllProducts);
        setIsActive(agent.isActive);
        setSelectedPageIds(agent.pages.map((ap) => ap.pageId));
        setSelectedProductIds(agent.products.map((ap) => ap.productId));
      } catch (err) {
        setError(err instanceof Error ? err.message : t('shell.form.err.load'));
      } finally {
        setLoadingAgent(false);
      }
    })();
  }, [agentId]);

  // Pre-fill from a ready-to-use template (new-agent flow only, once on mount)
  useEffect(() => {
    if (isEdit || !templateKey) return;
    const tpl = getAgentTemplate(templateKey);
    if (!tpl) return;
    setName(tpl.name);
    setDescription(tpl.tagline);
    setPersonality(tpl.personality);
    setCustomInstructions(tpl.customInstructions);
    setProductTemplate(tpl.productTemplate);
    setClosingInstructions(tpl.closingInstructions);
    setHumanHandoffRules(tpl.humanHandoffRules);
    setImageRecognition(tpl.imageRecognition);
    setVoiceTranscription(tpl.voiceTranscription);
    setResponseDelay(tpl.responseDelay);
    setAiModel(tpl.aiModel);
    setTemperature(tpl.temperature);
    setMaxTokens(tpl.maxTokens);
    setAppliedTemplate(tpl.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateKey, isEdit]);

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
      setError(t('shell.form.err.name'));
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
        humanHandoffRules: humanHandoffRules.trim() || undefined,
        imageRecognition,
        voiceTranscription,
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
      setError(err?.message || t('shell.form.err.save'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  if (loadingAgent) {
    return (
      <div className="w-full">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-zinc-800 rounded w-48" />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="h-96 bg-zinc-800 rounded-xl" />
            <div className="h-96 bg-zinc-800 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6" dir={dir}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/dashboard/agents')}
          className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
            {isEdit ? t('shell.form.title.edit') : t('shell.form.title.new')}
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {isEdit
              ? t('shell.form.sub.edit')
              : appliedTemplate
                ? t('shell.form.sub.template').replace('{name}', appliedTemplate)
                : t('shell.form.sub.new')}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ms-2 underline text-xs">{t('common.dismiss')}</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* ── Left column: behavior & prompt ── */}
        <div className="space-y-6">
        {/* Basic Info */}
        <section className="bg-zinc-900/50 border border-white/10 rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">{t('shell.form.basic')}</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">{t('shell.form.name')} *</label>
              <div className="relative">
                <BotIcon className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('shell.form.namePh')}
                  className="w-full bg-black/50 border border-white/10 rounded-lg ps-10 pe-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:border-white/30 focus:outline-none transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">{t('shell.form.description')}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('shell.form.descPh')}
                rows={2}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:border-white/30 focus:outline-none transition-colors resize-none"
              />
            </div>

            {/* Active Toggle */}
            {isEdit && (
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-zinc-300">{t('shell.common.active')}</p>
                  <p className="text-xs text-zinc-500">{t('shell.form.activeHint')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    isActive ? 'bg-white' : 'bg-white/10'
                  }`}
                >
                  <div className={`absolute top-0.5 start-0.5 w-5 h-5 rounded-full transition-transform ${
                    isActive ? 'translate-x-5 rtl:-translate-x-5 bg-black' : 'translate-x-0 bg-white'
                  }`} />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Personality */}
        <section className="bg-zinc-900/50 border border-white/10 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">{t('shell.form.personality')}</h2>
          <div className="grid grid-cols-2 gap-3">
            {personalities.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPersonality(p.value)}
                className={`relative p-4 rounded-xl border text-start transition-all ${
                  personality === p.value
                    ? 'bg-white/5 border-white/40 text-white'
                    : 'bg-black/30 border-white/10 text-zinc-400 hover:border-white/20'
                }`}
              >
                {personality === p.value && (
                  <CheckCircleIcon className="absolute top-3 end-3 w-4 h-4" />
                )}
                <p className="font-medium text-sm">{t(p.labelKey)}</p>
                <p className={`text-xs mt-0.5 ${personality === p.value ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  {t(p.descKey)}
                </p>
              </button>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">{t('shell.form.custom')}</label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder={t('shell.form.customPh')}
              rows={4}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:border-white/30 focus:outline-none transition-colors resize-none"
            />
            <p className="text-xs text-zinc-500 mt-1">
              {t('shell.form.customHint')}
            </p>
          </div>

          {/* Closing Instructions */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">{t('shell.form.closing')}</label>
            <textarea
              value={closingInstructions}
              onChange={(e) => setClosingInstructions(e.target.value)}
              placeholder={t('shell.form.closingPh')}
              rows={5}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:border-white/30 focus:outline-none transition-colors resize-none"
            />
            <p className="text-xs text-zinc-500 mt-1">
              {t('shell.form.closingHint')}
            </p>
          </div>

          {/* Human Handoff Rules */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">{t('shell.form.handoff')}</label>
            <textarea
              value={humanHandoffRules}
              onChange={(e) => setHumanHandoffRules(e.target.value)}
              placeholder={t('shell.form.handoffPh')}
              rows={5}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:border-white/30 focus:outline-none transition-colors resize-none"
            />
            <p className="text-xs text-zinc-500 mt-1">
              {t('shell.form.handoffHint')}
            </p>
          </div>
        </section>

        {/* Product Display Template */}
        <section className="bg-zinc-900/50 border border-white/10 rounded-xl p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-1">{t('shell.form.tpl')}</h2>
            <p className="text-xs text-zinc-500">
              {t('shell.form.tplDesc')}
            </p>
          </div>

          <div>
            <p className="text-[11px] text-zinc-500 mb-2">
              {t('shell.form.tplClickHint')}
            </p>

            {/* Clickable tag chips */}
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                { tag: '[PRODUCT_CARD]', label: t('shell.form.chip.card'), color: 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10' },
                { tag: '{name}', label: t('shell.form.chip.name'), color: 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10' },
                { tag: '{price}', label: t('shell.form.chip.price'), color: 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10' },
                { tag: '{description}', label: t('shell.form.chip.desc'), color: 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10' },
                { tag: '{stock}', label: t('shell.form.chip.stock'), color: 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10' },
                { tag: '\\n', label: t('shell.form.chip.newline'), color: 'bg-white/5 text-zinc-500 border-white/10 hover:bg-white/10' },
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
              placeholder={t('shell.form.tplPh')}
              rows={6}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-zinc-600 focus:border-white/30 focus:outline-none transition-colors resize-none"
            />
          </div>

          {/* Live preview */}
          <div>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">{t('shell.form.preview')}</p>
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
              {/* Customer */}
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-[10px] font-semibold text-zinc-300 flex-shrink-0">C</div>
                <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-3 py-2 max-w-[75%]">
                  <p className="text-sm text-zinc-200">{t('shell.form.previewCustomer')}</p>
                </div>
              </div>

              {/* Agent response based on template */}
              <div className="flex gap-2 flex-row-reverse">
                <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                  <BotIcon className="w-3.5 h-3.5 text-zinc-300" />
                </div>
                <div className="max-w-[80%] space-y-2">
                  {(() => {
                    const sampleProduct = products.find((p) => sellAllProducts || selectedProductIds.includes(p.id));
                    const sampleName = sampleProduct?.name || t('shell.form.sampleName');
                    const samplePrice = sampleProduct ? Number(sampleProduct.sellingPrice).toLocaleString() : '1,500';
                    const sampleDesc = sampleProduct?.description || t('shell.form.sampleDesc');

                    const template = productTemplate.trim() || t('shell.form.previewDefault');

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
                              <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tr-sm px-3 py-2">
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
                                  <p className="text-xs text-zinc-400 mt-0.5">{samplePrice} DA</p>
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
                  {t('shell.form.livePreview')}
                </span>
              </div>
            </div>
          </div>
        </section>
        </div>

        {/* ── Right column: model, pages & products ── */}
        <div className="space-y-6">
        {/* AI Model Config */}
        <section className="bg-zinc-900/50 border border-white/10 rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">{t('shell.form.model')}</h2>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-3">{t('shell.form.modelLabel')}</label>
            {activeProviders.length > 0 ? (
              <div className="space-y-4 max-h-80 overflow-y-auto pe-1">
                {activeProviders.map((group) => (
                  <div key={group.provider}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-zinc-500">
                      {group.displayName}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {group.models.map((modelId) => {
                        const info = modelLabels[modelId] || { label: modelId, desc: '' };
                        const priceLabel = costPer1000Label(modelId);
                        return (
                          <button
                            key={modelId}
                            type="button"
                            onClick={() => setAiModel(modelId)}
                            className={`p-2.5 rounded-lg border text-start transition-all ${
                              aiModel === modelId
                                ? 'bg-white/10 border-white/30 text-white'
                                : 'bg-black/30 border-white/5 text-zinc-400 hover:border-white/15'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium text-sm">{info.label}</p>
                              {priceLabel && (
                                <span className="text-[10px] font-mono text-zinc-500 whitespace-nowrap pt-0.5">
                                  {priceLabel}
                                </span>
                              )}
                            </div>
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
                {t('shell.form.loadingModels')}
              </div>
            ) : (
              <div className="text-center py-4 text-sm text-zinc-500">
                {t('shell.form.noModels')}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-zinc-300">{t('shell.form.temperature')}</label>
              <span className="text-sm font-mono text-zinc-400">{temperature.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-white h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <div className="flex justify-between text-xs text-zinc-600 mt-1">
              <span>{t('shell.form.precise')}</span>
              <span>{t('shell.form.creative')}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">{t('shell.form.maxTokens')}</label>
            <input
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(Math.max(100, Math.min(4096, parseInt(e.target.value) || 1024)))}
              min={100}
              max={4096}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-white/30 focus:outline-none transition-colors"
            />
            <p className="text-xs text-zinc-500 mt-1">{t('shell.form.maxTokensHint')}</p>
          </div>

          {/* Image Recognition Toggle */}
          <div className="flex items-center justify-between p-4 bg-black/30 border border-white/5 rounded-lg">
            <div>
              <h3 className="text-sm font-medium text-zinc-300">{t('shell.form.imageRec')}</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                {t('shell.form.imageRecHint')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setImageRecognition(!imageRecognition)}
              className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${imageRecognition ? 'bg-white' : 'bg-white/10'}`}
            >
              <span className={`absolute top-0.5 start-0.5 w-6 h-6 rounded-full transition-transform ${imageRecognition ? 'translate-x-5 rtl:-translate-x-5 bg-black' : 'bg-white'}`} />
            </button>
          </div>

          {/* Voice Transcription Toggle */}
          <div className="flex items-center justify-between p-4 bg-black/30 border border-white/5 rounded-lg">
            <div>
              <h3 className="text-sm font-medium text-zinc-300">{t('shell.form.voice')}</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                {t('shell.form.voiceHint')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setVoiceTranscription(!voiceTranscription)}
              className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${voiceTranscription ? 'bg-white' : 'bg-white/10'}`}
            >
              <span className={`absolute top-0.5 start-0.5 w-6 h-6 rounded-full transition-transform ${voiceTranscription ? 'translate-x-5 rtl:-translate-x-5 bg-black' : 'bg-white'}`} />
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-zinc-300">{t('shell.form.delay')}</label>
              <span className="text-sm font-mono text-zinc-400">{responseDelay}s</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={responseDelay}
              onChange={(e) => setResponseDelay(parseInt(e.target.value))}
              className="w-full accent-white h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
              <span>{t('shell.form.instant')}</span>
              <span>{t('shell.form.wait10')}</span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              {t('shell.form.delayHint')}
            </p>
          </div>
        </section>

        {/* Connected Pages */}
        <section className="bg-zinc-900/50 border border-white/10 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">{t('shell.form.pages')}</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {t('shell.form.pagesHint')}
              </p>
            </div>
            {pages.length > 0 && (
              <span className="text-[11px] text-zinc-500">
                {t('shell.form.selectedOf')
                  .replace('{n}', String(selectedPageIds.length))
                  .replace('{m}', String(pages.length))}
              </span>
            )}
          </div>

          {pages.length > 0 ? (
            <>
              {/* Quick select shortcuts */}
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectedPageIds(pages.map((p) => p.id))}
                  className="text-zinc-400 hover:text-white transition-colors"
                  disabled={selectedPageIds.length === pages.length}
                >
                  {t('shell.form.selectAll')}
                </button>
                <span className="text-zinc-700">·</span>
                <button
                  type="button"
                  onClick={() => setSelectedPageIds([])}
                  className="text-zinc-400 hover:text-white transition-colors"
                  disabled={selectedPageIds.length === 0}
                >
                  {t('shell.form.clear')}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {pages.map((page) => {
                  const isSelected = selectedPageIds.includes(page.id);
                  const isInstagram = page.platform === 'instagram';
                  const Icon = isInstagram ? InstagramIcon : FacebookIcon;
                  const platformBg = 'bg-white/[0.03]';
                  const platformIconColor = 'text-zinc-500';
                  const pictureUrl = !isInstagram
                    ? `https://graph.facebook.com/v18.0/${page.pageId}/picture?type=large`
                    : null;

                  return (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => togglePage(page.id)}
                      className={`group relative text-start rounded-xl border-2 overflow-hidden transition-all ${
                        isSelected
                          ? 'border-white/40 bg-white/5 ring-2 ring-white/10'
                          : 'border-white/10 bg-black/30 hover:border-white/25 hover:bg-white/[0.02]'
                      }`}
                    >
                      {/* Banner accent */}
                      <div className={`h-12 ${platformBg} relative`}>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.06),transparent_60%)]" />
                        {/* Selection check (top-right) */}
                        <div
                          className={`absolute top-2 end-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-white border-white'
                              : 'bg-black/50 border-white/30 group-hover:border-white/60'
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-3.5 h-3.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>

                      <div className="px-3.5 pb-3.5 pt-0 -mt-7 flex items-start gap-3">
                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-xl bg-zinc-950 border-[3px] border-zinc-950 overflow-hidden flex-shrink-0 shadow-lg">
                          <PageAvatar pictureUrl={pictureUrl} fallback={page.pageName} icon={<Icon className={`w-5 h-5 ${platformIconColor}`} />} />
                        </div>

                        <div className="min-w-0 flex-1 pt-1">
                          <p
                            className={`text-sm font-semibold truncate ${
                              isSelected ? 'text-white' : 'text-zinc-200'
                            }`}
                          >
                            {page.pageName}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Icon className={`w-3 h-3 flex-shrink-0 ${platformIconColor}`} />
                            <span className="text-[11px] text-zinc-500 capitalize">{page.platform}</span>
                            <span className="text-zinc-700">·</span>
                            {page.isActive ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                {t('shell.common.active')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full border border-zinc-600" />
                                {t('shell.common.inactive')}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-600 mt-1">
                            {t('dash.pageCard.connectedOn').replace('{date}', formatRelativeDate(page.createdAt, t))}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 mx-auto mb-3 flex items-center justify-center">
                <FacebookIcon className="w-5 h-5 text-zinc-500" />
              </div>
              <p className="text-sm text-white font-semibold mb-1">{t('shell.form.noPages')}</p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto mb-4">
                {t('shell.form.noPagesHint')}
              </p>
              <a
                href="/dashboard?section=pages"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-black rounded-lg text-xs font-semibold hover:bg-zinc-100 transition-colors"
              >
                {t('shell.form.openSocial')}
              </a>
            </div>
          )}
        </section>

        {/* Products */}
        <section className="bg-zinc-900/50 border border-white/10 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">{t('shell.form.products')}</h2>

          {/* Sell All Toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-zinc-300">{t('shell.form.sellAll')}</p>
              <p className="text-xs text-zinc-500">{t('shell.form.sellAllHint')}</p>
            </div>
            <button
              type="button"
              onClick={() => setSellAllProducts(!sellAllProducts)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                sellAllProducts ? 'bg-white' : 'bg-white/10'
              }`}
            >
              <div className={`absolute top-0.5 start-0.5 w-5 h-5 rounded-full transition-transform ${
                sellAllProducts ? 'translate-x-5 rtl:-translate-x-5 bg-black' : 'translate-x-0 bg-white'
              }`} />
            </button>
          </div>

          {/* Product Selection (when not selling all) */}
          {!sellAllProducts && (
            <div className="space-y-3">
              <div className="relative">
                <SearchIcon className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder={t('shell.form.searchProducts')}
                  className="w-full bg-black/50 border border-white/10 rounded-lg ps-10 pe-4 py-2 text-white text-sm placeholder-zinc-600 focus:border-white/30 focus:outline-none transition-colors"
                />
              </div>

              {selectedProductIds.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span>{t('shell.form.nSelected').replace('{n}', String(selectedProductIds.length))}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedProductIds([])}
                    className="text-zinc-400 hover:text-white underline"
                  >
                    {t('shell.form.clearLower')}
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
                            ? 'bg-white/5 border-white/40'
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
                          <div className="text-start">
                            <p className={`text-sm ${isSelected ? 'text-white' : 'text-zinc-300'}`}>{product.name}</p>
                            <p className="text-xs text-zinc-500">{product.sku} &middot; {product.sellingPrice.toLocaleString()} DA</p>
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-white border-white'
                            : 'border-zinc-600'
                        }`}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
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
                      {productSearch ? t('shell.form.noMatch') : t('shell.form.noProducts')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
        </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 pb-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/dashboard/agents')}
          >
            {t('shell.common.cancel')}
          </Button>
          <Button
            type="submit"
            loading={saving}
            icon={isEdit ? undefined : <BotIcon className="w-4 h-4" />}
          >
            {saving ? t('shell.common.saving') : isEdit ? t('shell.form.saveChanges') : t('shell.form.create')}
          </Button>
        </div>
      </form>
    </div>
  );
}

// Tiny avatar component that renders the FB picture URL with a fallback to
// the page's first-letter when the request 404s or the user is on Instagram.
function PageAvatar({
  pictureUrl,
  fallback,
  icon,
}: {
  pictureUrl: string | null;
  fallback: string;
  icon: React.ReactNode;
}) {
  const [errored, setErrored] = useState(false);
  if (pictureUrl && !errored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={pictureUrl}
        alt={fallback}
        referrerPolicy="no-referrer"
        onError={() => setErrored(true)}
        className="w-full h-full object-cover"
      />
    );
  }
  return (
    <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-300 text-sm font-semibold">
      {icon || (fallback || '?').charAt(0).toUpperCase()}
    </div>
  );
}

function formatRelativeDate(iso: string, t: (key: string, fallback?: string) => string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const day = 86_400_000;
  if (diff < day) return t('shell.rel.today');
  if (diff < 2 * day) return t('shell.rel.yesterday');
  if (diff < 30 * day) return t('shell.rel.daysAgo').replace('{n}', String(Math.floor(diff / day)));
  if (diff < 365 * day) {
    const months = Math.floor(diff / (30 * day));
    return t(months === 1 ? 'shell.rel.monthAgo' : 'shell.rel.monthsAgo').replace('{n}', String(months));
  }
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}
