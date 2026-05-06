'use client';

import { useEffect, useState } from 'react';
import {
  generatePageAgent,
  updatePageAISettings,
  type GeneratedAgent,
} from '@/lib/page-config-api';
import { useToast } from '@/components/ui/Toast';

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
      setError(err?.message || 'Could not generate AI agent');
      setPhase('idle');
    }
  };

  const applyDraft = async () => {
    if (!draft) return;
    setPhase('applying');
    try {
      await updatePageAISettings(pageId, {
        aiEnabled: true,
        aiPersonality: draft.personality,
        responseTone: draft.responseTone,
        responseLength: draft.responseLength,
        customInstructions: editedInstructions,
        autoReply: true,
      });
      toast.success('AI agent applied to ' + pageName);
      onApplied?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Could not apply settings');
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
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🧠</span>
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                Generate AI agent from inbox
              </h2>
            </div>
            <p className="text-xs text-zinc-500">
              We&apos;ll read the recent conversations on <span className="text-zinc-300">{pageName}</span> and draft a tailored agent.
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
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-emerald-300 mb-2">What this does</h3>
                <ul className="space-y-1.5 text-xs text-zinc-300">
                  <li className="flex gap-2"><span className="text-emerald-400">•</span> Reads up to 25 recent conversations on this page (we don&apos;t store any new copy)</li>
                  <li className="flex gap-2"><span className="text-emerald-400">•</span> Detects what you sell, the languages your customers use, and the most common questions</li>
                  <li className="flex gap-2"><span className="text-emerald-400">•</span> Drafts a personality, tone, response length, and custom instructions tailored to your business</li>
                  <li className="flex gap-2"><span className="text-emerald-400">•</span> You preview, edit, and apply — nothing is changed until you click Apply</li>
                </ul>
              </div>
              {error && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 text-sm text-rose-300">
                  {error}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={startGeneration}
                  className="px-5 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-zinc-100 transition-colors"
                >
                  Read inbox & generate
                </button>
              </div>
            </div>
          )}

          {(phase === 'reading' || phase === 'analyzing' || phase === 'drafting') && (
            <div className="py-12">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white mb-1">
                    {phase === 'reading' && 'Reading recent conversations…'}
                    {phase === 'analyzing' && 'Understanding context — products, language, tone…'}
                    {phase === 'drafting' && 'Drafting your tailored AI agent…'}
                  </p>
                  <p className="text-xs text-zinc-500">This usually takes 10–30 seconds.</p>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Step active={phase === 'reading'} done={phase !== 'reading'} label="Read" />
                  <Connector />
                  <Step active={phase === 'analyzing'} done={phase === 'drafting'} label="Analyze" />
                  <Connector />
                  <Step active={phase === 'drafting'} done={false} label="Draft" />
                </div>
              </div>
            </div>
          )}

          {phase === 'preview' && draft && (
            <div className="space-y-4">
              {draft.warning && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-300">
                  ⚠️ {draft.warning}
                </div>
              )}

              <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-xs uppercase tracking-wider text-zinc-500">Business summary</h3>
                  <span className="text-[10px] text-zinc-600">
                    {draft.sampledConversations} conversations · {draft.sampledMessages} messages
                  </span>
                </div>
                <p className="text-sm text-white leading-relaxed">{draft.businessSummary}</p>
                {draft.languages.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 me-1">Languages</span>
                    {draft.languages.map((l) => (
                      <span key={l} className="text-[11px] px-2 py-0.5 bg-white/5 rounded-full text-zinc-300">
                        {l}
                      </span>
                    ))}
                  </div>
                )}
                {draft.topQuestions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 me-1">Top questions</span>
                    {draft.topQuestions.map((q) => (
                      <span key={q} className="text-[11px] px-2 py-0.5 bg-emerald-500/10 text-emerald-300 rounded-full">
                        {q}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <PreviewPill label="Personality" value={draft.personality} />
                <PreviewPill label="Tone" value={draft.responseTone} />
                <PreviewPill label="Length" value={draft.responseLength} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs uppercase tracking-wider text-zinc-500">Custom instructions</label>
                  <span className="text-[10px] text-zinc-600">{editedInstructions.length} chars</span>
                </div>
                <textarea
                  value={editedInstructions}
                  onChange={(e) => setEditedInstructions(e.target.value)}
                  rows={10}
                  className="w-full bg-black/40 border border-white/10 focus:border-emerald-500/40 rounded-lg text-xs text-zinc-200 px-3 py-2.5 focus:outline-none font-mono leading-relaxed resize-y"
                />
                <p className="text-[10px] text-zinc-600 mt-1">
                  Edit anything before applying. These instructions are saved on this page&apos;s AI settings.
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
                  Discard
                </button>
                <button
                  onClick={applyDraft}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  Apply to {pageName}
                </button>
              </div>
            </div>
          )}

          {phase === 'applying' && (
            <div className="py-12 text-center">
              <div className="inline-flex items-center gap-3 text-zinc-400">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span className="text-sm">Applying settings…</span>
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
          done ? 'bg-emerald-500 text-white' : active ? 'bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-500/40' : 'bg-white/5 text-zinc-500'
        }`}
      >
        {done ? '✓' : ''}
      </div>
      <span className={`text-[11px] ${active ? 'text-emerald-300' : done ? 'text-zinc-400' : 'text-zinc-600'}`}>{label}</span>
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
