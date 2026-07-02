'use client';

import { useEffect, useState } from 'react';
import {
  generatePageAgent,
  applyPageAgent,
  type GeneratedAgent,
} from '@/lib/page-config-api';
import { useToast } from '@/components/ui/Toast';
import { SparklesIcon, AlertIcon } from '@/components/ui/icons';
import { useTranslation } from '@/contexts/LanguageContext';

interface GenerateAgentModalProps {
  pageId: string;
  pageName: string;
  isOpen: boolean;
  onClose: () => void;
  onApplied?: () => void;
}

export default function GenerateAgentModal({
  pageId,
  pageName,
  isOpen,
  onClose,
  onApplied,
}: GenerateAgentModalProps) {
  const toast = useToast();
  const { t } = useTranslation();
  const [phase, setPhase] = useState<'idle' | 'reading' | 'analyzing' | 'drafting' | 'preview' | 'applying'>(
    'idle',
  );
  const [draft, setDraft] = useState<GeneratedAgent | null>(null);
  const [editedInstructions, setEditedInstructions] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setPhase('idle');
      setDraft(null);
      setEditedInstructions('');
      setError(null);
    }
  }, [isOpen]);

  const startGeneration = async () => {
    setPhase('reading');
    setError(null);
    try {
      // Stagger phase labels for the user — the actual call is one round trip
      const phaseTimer1 = setTimeout(() => setPhase('analyzing'), 1000);
      const phaseTimer2 = setTimeout(() => setPhase('drafting'), 3500);
      const result = await generatePageAgent(pageId);
      clearTimeout(phaseTimer1);
      clearTimeout(phaseTimer2);
      setDraft(result);
      setEditedInstructions(result.customInstructions);
      setPhase('preview');
    } catch (err: any) {
      setError(err?.message || t('agentGen.toast.genFail'));
      setPhase('idle');
    }
  };

  const applyDraft = async () => {
    if (!draft) return;
    setPhase('applying');
    try {
      const res = await applyPageAgent(pageId, {
        personality: draft.personality,
        responseTone: draft.responseTone,
        responseLength: draft.responseLength,
        customInstructions: editedInstructions,
        businessSummary: draft.businessSummary,
      });
      toast.success(
        (res.created
          ? t('agentGen.toast.created')
          : t('agentGen.toast.updated')
        ).replace('{pageName}', pageName),
      );
      onApplied?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || t('agentGen.toast.fail'));
      setPhase('preview');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-3xl my-8 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-zinc-300 flex items-center justify-center flex-shrink-0">
                <SparklesIcon className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                {t('agentGen.title')}
              </h2>
            </div>
            <p className="text-xs text-zinc-500">
              {t('agentGen.subtitle').split('{pageName}').map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && <span className="text-zinc-300">{pageName}</span>}
                </span>
              ))}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors text-xl leading-none -mt-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {phase === 'idle' && (
            <div className="space-y-4">
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-2">{t('agentGen.what.title')}</h3>
                <ul className="space-y-1.5 text-xs text-zinc-400">
                  <li className="flex gap-2"><span className="text-zinc-600">•</span> {t('agentGen.what.l1')}</li>
                  <li className="flex gap-2"><span className="text-zinc-600">•</span> {t('agentGen.what.l2')}</li>
                  <li className="flex gap-2"><span className="text-zinc-600">•</span> {t('agentGen.what.l3')}</li>
                  <li className="flex gap-2"><span className="text-zinc-600">•</span> {t('agentGen.what.l4')}</li>
                </ul>
              </div>
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
                  {error}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  {t('agentGen.cancel')}
                </button>
                <button
                  onClick={startGeneration}
                  className="px-5 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-zinc-100 transition-colors"
                >
                  {t('agentGen.start')}
                </button>
              </div>
            </div>
          )}

          {(phase === 'reading' || phase === 'analyzing' || phase === 'drafting') && (
            <div className="py-12">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white mb-1">
                    {phase === 'reading' && t('agentGen.phase.reading')}
                    {phase === 'analyzing' && t('agentGen.phase.analyzing')}
                    {phase === 'drafting' && t('agentGen.phase.drafting')}
                  </p>
                  <p className="text-xs text-zinc-500">{t('agentGen.phase.subhint')}</p>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Step active={phase === 'reading'} done={phase !== 'reading'} label={t('agentGen.phase.step.read')} />
                  <Connector />
                  <Step active={phase === 'analyzing'} done={phase === 'drafting'} label={t('agentGen.phase.step.analyze')} />
                  <Connector />
                  <Step active={phase === 'drafting'} done={false} label={t('agentGen.phase.step.draft')} />
                </div>
              </div>
            </div>
          )}

          {phase === 'preview' && draft && (
            <div className="space-y-4">
              {draft.warning && (
                <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3 text-xs text-zinc-400 flex items-start gap-2">
                  <AlertIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-zinc-500" />
                  <span className="text-white font-medium">{draft.warning}</span>
                </div>
              )}

              <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-xs uppercase tracking-wider text-zinc-500">{t('agentGen.preview.summary')}</h3>
                  <span className="text-[10px] text-zinc-600">
                    {draft.sampledConversations} conversations · {draft.sampledMessages} messages
                  </span>
                </div>
                <p className="text-sm text-white leading-relaxed">{draft.businessSummary}</p>
                {draft.languages.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 me-1">{t('agentGen.preview.languages')}</span>
                    {draft.languages.map((l) => (
                      <span key={l} className="text-[11px] px-2 py-0.5 bg-white/5 rounded-full text-zinc-300">
                        {l}
                      </span>
                    ))}
                  </div>
                )}
                {draft.topQuestions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 me-1">{t('agentGen.preview.topQuestions')}</span>
                    {draft.topQuestions.map((q) => (
                      <span key={q} className="text-[11px] px-2 py-0.5 bg-white/5 text-zinc-300 rounded-full">
                        {q}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <PreviewPill label={t('agentGen.preview.personality')} value={draft.personality} />
                <PreviewPill label={t('agentGen.preview.tone')} value={draft.responseTone} />
                <PreviewPill label={t('agentGen.preview.length')} value={draft.responseLength} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs uppercase tracking-wider text-zinc-500">{t('agentGen.preview.instructions')}</label>
                  <span className="text-[10px] text-zinc-600">{editedInstructions.length} chars</span>
                </div>
                <textarea
                  value={editedInstructions}
                  onChange={(e) => setEditedInstructions(e.target.value)}
                  rows={10}
                  className="w-full bg-black/40 border border-white/10 focus:border-white/30 rounded-lg text-xs text-zinc-200 px-3 py-2.5 focus:outline-none font-mono leading-relaxed resize-y"
                />
                <p className="text-[10px] text-zinc-600 mt-1">
                  {t('agentGen.preview.editHint')}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setPhase('idle');
                    setDraft(null);
                  }}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  {t('agentGen.preview.discard')}
                </button>
                <button
                  onClick={applyDraft}
                  className="px-5 py-2 bg-white hover:bg-zinc-100 text-black rounded-lg text-sm font-semibold transition-colors"
                >
                  {t('agentGen.preview.apply').replace('{pageName}', pageName)}
                </button>
              </div>
            </div>
          )}

          {phase === 'applying' && (
            <div className="py-12 text-center">
              <div className="inline-flex items-center gap-3 text-zinc-400">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span className="text-sm">{t('agentGen.applying')}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Step({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
          done ? 'bg-white text-black' : active ? 'bg-white/10 text-white ring-2 ring-white/30' : 'bg-white/5 text-zinc-500'
        }`}
      >
        {done ? '✓' : ''}
      </div>
      <span className={`text-[11px] ${active ? 'text-white' : done ? 'text-zinc-400' : 'text-zinc-600'}`}>{label}</span>
    </div>
  );
}

function Connector() {
  return <div className="w-6 h-px bg-white/10" />;
}

function PreviewPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-lg p-3">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{label}</p>
      <p className="text-sm font-semibold text-white capitalize">{value}</p>
    </div>
  );
}
