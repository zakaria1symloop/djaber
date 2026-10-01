'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';

// USD per 1M tokens. Source: each provider's public pricing page (Jan 2026).
interface ModelPricing {
  provider: string;
  model: string;
  inputPer1M: number;
  outputPer1M: number;
  noteKey?: string;
}

const PRICING: ModelPricing[] = [
  { provider: 'openai', model: 'gpt-4o', inputPer1M: 2.5, outputPer1M: 10 },
  { provider: 'openai', model: 'gpt-4o-mini', inputPer1M: 0.15, outputPer1M: 0.6, noteKey: 'adm.plat.calc.note.cheapest' },
  { provider: 'openai', model: 'gpt-4-turbo', inputPer1M: 10, outputPer1M: 30 },
  { provider: 'openai', model: 'gpt-3.5-turbo', inputPer1M: 0.5, outputPer1M: 1.5 },
  { provider: 'openai', model: 'o1', inputPer1M: 15, outputPer1M: 60, noteKey: 'adm.plat.calc.note.reasoning' },
  { provider: 'openai', model: 'o1-mini', inputPer1M: 3, outputPer1M: 12, noteKey: 'adm.plat.calc.note.reasoning' },
  { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', inputPer1M: 3, outputPer1M: 15 },
  { provider: 'anthropic', model: 'claude-3-5-haiku-20241022', inputPer1M: 0.8, outputPer1M: 4 },
  { provider: 'anthropic', model: 'claude-3-opus-20240229', inputPer1M: 15, outputPer1M: 75 },
  { provider: 'google', model: 'gemini-2.0-flash', inputPer1M: 0.1, outputPer1M: 0.4, noteKey: 'adm.plat.calc.note.freeTier' },
  { provider: 'google', model: 'gemini-1.5-pro', inputPer1M: 1.25, outputPer1M: 5 },
  { provider: 'google', model: 'gemini-1.5-flash', inputPer1M: 0.075, outputPer1M: 0.3 },
  { provider: 'groq', model: 'llama-3.3-70b-versatile', inputPer1M: 0.59, outputPer1M: 0.79 },
  { provider: 'groq', model: 'llama-3.1-8b-instant', inputPer1M: 0.05, outputPer1M: 0.08, noteKey: 'adm.plat.calc.note.cheapestOverall' },
  { provider: 'groq', model: 'mixtral-8x7b-32768', inputPer1M: 0.24, outputPer1M: 0.24 },
];

// 1 credit = $0.001 by default (1¢ buys 10 credits).
const DEFAULT_USD_PER_CREDIT = 0.001;

// Realistic chat assumptions for a Messenger e-commerce agent.
const DEFAULTS = {
  systemPromptTokens: 1000, // agent personality + product catalog summary
  customerMsgTokens: 60, // avg customer message length
  agentReplyTokens: 200, // avg agent reply length
  visionExtraInput: 1000, // extra input tokens when an image is attached
  voiceWhisperUSD: 0.003, // Whisper transcription cost per voice note (~30s)
};

const PROVIDER_COLOR: Record<string, string> = {
  openai: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  anthropic: 'text-orange-300 bg-orange-500/10 border-orange-500/20',
  google: 'text-blue-300 bg-blue-500/10 border-blue-500/20',
  groq: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
};

function fmtUSD(usd: number): string {
  if (usd === 0) return '$0';
  if (usd < 0.0001) return `$${usd.toExponential(1)}`;
  if (usd < 0.01) return `$${usd.toFixed(5)}`;
  if (usd < 1) return `$${usd.toFixed(4)}`;
  if (usd < 100) return `$${usd.toFixed(2)}`;
  return `$${Math.round(usd).toLocaleString()}`;
}

function fmtCredits(credits: number): string {
  if (credits === 0) return '0';
  if (credits < 1) return credits.toFixed(2);
  if (credits < 100) return credits.toFixed(1);
  return Math.round(credits).toLocaleString();
}

/**
 * Simulate the cost of a single chat conversation.
 *
 * Each agent reply carries the FULL conversation history as input — so per-call
 * input grows linearly with message count, and the SUM across all calls grows
 * quadratically. We approximate that.
 *
 * Per chat with `N` exchanges (N customer messages + N agent replies):
 *   sum_input  = N * sysPrompt + sum_{k=1..N}(k * (custMsg + reply))
 *              = N * sysPrompt + (custMsg + reply) * N(N+1)/2
 *   sum_output = N * reply
 *
 * Vision adds extra input tokens once per image-bearing chat.
 * Voice adds a separate Whisper USD cost.
 */
function simulateChat(args: {
  messagesPerChat: number;
  systemPromptTokens: number;
  customerMsgTokens: number;
  agentReplyTokens: number;
  visionFraction: number; // 0..1 — fraction of chats that include an image
  voiceFraction: number; // 0..1 — fraction of chats that include a voice note
  inputPer1M: number;
  outputPer1M: number;
}): { perChatUSD: number; tokensIn: number; tokensOut: number } {
  const N = Math.max(1, args.messagesPerChat);
  const turn = args.customerMsgTokens + args.agentReplyTokens;
  const tokensIn = N * args.systemPromptTokens + (turn * N * (N + 1)) / 2;
  const tokensOut = N * args.agentReplyTokens;

  const visionExtraIn = args.visionFraction * DEFAULTS.visionExtraInput;
  const totalIn = tokensIn + visionExtraIn;

  const llmUSD = (totalIn / 1e6) * args.inputPer1M + (tokensOut / 1e6) * args.outputPer1M;
  const voiceUSD = args.voiceFraction * DEFAULTS.voiceWhisperUSD;
  return { perChatUSD: llmUSD + voiceUSD, tokensIn: totalIn, tokensOut };
}

export default function PricingCalculator() {
  const { t } = useTranslation();
  const [model, setModel] = useState<string>('gpt-4o-mini');
  const [chatsPerDay, setChatsPerDay] = useState<number>(50);
  const [messagesPerChat, setMessagesPerChat] = useState<number>(6);
  const [visionPct, setVisionPct] = useState<number>(15);
  const [voicePct, setVoicePct] = useState<number>(5);
  const [creditPeg, setCreditPeg] = useState<number>(DEFAULT_USD_PER_CREDIT);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [sysPrompt, setSysPrompt] = useState<number>(DEFAULTS.systemPromptTokens);
  const [custMsg, setCustMsg] = useState<number>(DEFAULTS.customerMsgTokens);
  const [reply, setReply] = useState<number>(DEFAULTS.agentReplyTokens);

  const selected = PRICING.find((p) => p.model === model) || PRICING[0];

  const perChat = useMemo(
    () =>
      simulateChat({
        messagesPerChat,
        systemPromptTokens: sysPrompt,
        customerMsgTokens: custMsg,
        agentReplyTokens: reply,
        visionFraction: visionPct / 100,
        voiceFraction: voicePct / 100,
        inputPer1M: selected.inputPer1M,
        outputPer1M: selected.outputPer1M,
      }),
    [messagesPerChat, sysPrompt, custMsg, reply, visionPct, voicePct, selected],
  );

  const perDayUSD = perChat.perChatUSD * chatsPerDay;
  const perMonthUSD = perDayUSD * 30;
  const perChatCredits = creditPeg > 0 ? perChat.perChatUSD / creditPeg : 0;
  const perMonthCredits = creditPeg > 0 ? perMonthUSD / creditPeg : 0;

  const chatsAtPlan = (planCredits: number) =>
    perChatCredits > 0 ? Math.floor(planCredits / perChatCredits) : Infinity;

  // Pick a recommended plan based on monthly credits needed
  const recommendedPlan = useMemo(() => {
    const m = perMonthCredits;
    if (m <= 500) return t('adm.plat.calc.plan.free');
    if (m <= 5000) return t('adm.plat.calc.plan.starter');
    if (m <= 20000) return t('adm.plat.calc.plan.growth');
    return t('adm.plat.calc.plan.pro');
  }, [perMonthCredits, t]);

  return (
    <div className="space-y-6">
      {/* Chat simulator */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2
              className="text-lg sm:text-xl font-bold text-white mb-1"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              {t('adm.plat.calc.title')}
            </h2>
            <p className="text-xs text-zinc-500">
              {t('adm.plat.calc.subtitle')}
            </p>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-zinc-600 whitespace-nowrap">
            {t('adm.plat.calc.recommended')} <span className="text-emerald-400 font-semibold">{recommendedPlan}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Inputs */}
          <div className="lg:col-span-2 space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 block">
                {t('adm.plat.calc.model')}
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/30 rounded-lg text-sm text-white focus:outline-none"
              >
                {(Object.keys(PROVIDER_COLOR) as Array<keyof typeof PROVIDER_COLOR>).map((prov) => (
                  <optgroup key={prov} label={prov.toUpperCase()}>
                    {PRICING.filter((p) => p.provider === prov).map((p) => (
                      <option key={p.model} value={p.model}>
                        {p.model}
                        {p.noteKey ? ` — ${t(p.noteKey)}` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <Slider
              label={t('adm.plat.calc.chatsPerDay')}
              hint={t('adm.plat.calc.chatsPerDayHint')}
              value={chatsPerDay}
              onChange={setChatsPerDay}
              min={1}
              max={500}
              step={1}
              suffix={chatsPerDay === 1 ? t('adm.plat.calc.chatPerDay') : t('adm.plat.calc.chatsPerDaySuffix')}
            />

            <Slider
              label={t('adm.plat.calc.msgsPerChat')}
              hint={messagesPerChat === 1 ? t('adm.plat.calc.msgsPerChatHintOne') : t('adm.plat.calc.msgsPerChatHint').split('{n}').join(String(messagesPerChat))}
              value={messagesPerChat}
              onChange={setMessagesPerChat}
              min={1}
              max={20}
              step={1}
              suffix={messagesPerChat === 1 ? t('adm.plat.calc.exchange') : t('adm.plat.calc.exchanges')}
            />

            <div className="grid grid-cols-2 gap-3">
              <Slider
                label={t('adm.plat.calc.withImage')}
                hint={t('adm.plat.calc.withImageHint')}
                value={visionPct}
                onChange={setVisionPct}
                min={0}
                max={100}
                step={5}
                suffix="%"
              />
              <Slider
                label={t('adm.plat.calc.withVoice')}
                hint={t('adm.plat.calc.withVoiceHint')}
                value={voicePct}
                onChange={setVoicePct}
                min={0}
                max={100}
                step={5}
                suffix="%"
              />
            </div>

            <div className="bg-black/30 border border-white/5 rounded-lg p-3 space-y-2">
              <button
                onClick={() => setAdvancedOpen((v) => !v)}
                className="w-full flex items-center justify-between text-[11px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <span>{t('adm.plat.calc.advanced')}</span>
                <span className="text-zinc-600">{advancedOpen ? '−' : '+'}</span>
              </button>
              {advancedOpen && (
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <NumField
                    label={t('adm.plat.calc.sysPrompt')}
                    value={sysPrompt}
                    onChange={setSysPrompt}
                    hint={t('adm.plat.calc.sysPromptHint')}
                  />
                  <NumField
                    label={t('adm.plat.calc.custMsg')}
                    value={custMsg}
                    onChange={setCustMsg}
                    hint={t('adm.plat.calc.custMsgHint')}
                  />
                  <NumField
                    label={t('adm.plat.calc.agentReply')}
                    value={reply}
                    onChange={setReply}
                    hint={t('adm.plat.calc.agentReplyHint')}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="text-[10px] uppercase tracking-wider text-zinc-500">
                {t('adm.plat.calc.creditPeg')}
              </label>
              <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1">
                <span className="text-zinc-500 text-xs">$</span>
                <input
                  type="number"
                  step="0.0001"
                  min={0.0001}
                  value={creditPeg}
                  onChange={(e) => setCreditPeg(Math.max(0.0001, parseFloat(e.target.value) || 0.0001))}
                  className="w-20 bg-transparent text-xs text-white focus:outline-none font-mono"
                />
              </div>
              <span className="text-[10px] text-zinc-600">
                {t('adm.plat.calc.creditPegHint')}
              </span>
            </div>
          </div>

          {/* Result panel */}
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-3.5">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-emerald-400/70 mb-0.5">{t('adm.plat.calc.costPerChat')}</p>
              <p className="text-lg font-bold text-emerald-300" style={{ fontFamily: 'Syne, sans-serif' }}>
                {fmtUSD(perChat.perChatUSD)}
              </p>
              <p className="text-[10px] text-emerald-400/60">{fmtCredits(perChatCredits)} {t('adm.plat.calc.credits')}</p>
            </div>

            <div className="border-t border-emerald-500/15 pt-3 space-y-1 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>{t('adm.plat.calc.perDay').replace('{n}', String(chatsPerDay))}</span>
                <span className="font-mono text-white">{fmtUSD(perDayUSD)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>{t('adm.plat.calc.perMonth')}</span>
                <span className="font-mono text-white font-semibold">{fmtUSD(perMonthUSD)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>{t('adm.plat.calc.monthlyCredits')}</span>
                <span className="font-mono text-emerald-300 font-semibold">
                  {fmtCredits(perMonthCredits)}
                </span>
              </div>
            </div>

            <div className="border-t border-emerald-500/15 pt-3 space-y-1.5 text-[11px]">
              <p className="text-[10px] uppercase tracking-wider text-emerald-400/70 mb-1">{t('adm.plat.calc.planCapacity')}</p>
              <div className="flex justify-between text-zinc-400">
                <span>{t('adm.plat.calc.plan500')}</span>
                <span className="font-mono text-emerald-300">
                  {chatsAtPlan(500).toLocaleString()} {t('adm.plat.calc.chats')}
                </span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>{t('adm.plat.calc.plan5k')}</span>
                <span className="font-mono text-emerald-300">
                  {chatsAtPlan(5000).toLocaleString()} {t('adm.plat.calc.chats')}
                </span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>{t('adm.plat.calc.plan20k')}</span>
                <span className="font-mono text-emerald-300">
                  {chatsAtPlan(20000).toLocaleString()} {t('adm.plat.calc.chats')}
                </span>
              </div>
            </div>

            <div className="border-t border-emerald-500/15 pt-3 text-[10px] text-emerald-400/50 space-y-0.5">
              <p>{t('adm.plat.calc.tokensIn').replace('{n}', Math.round(perChat.tokensIn).toLocaleString())}</p>
              <p>{t('adm.plat.calc.tokensOut').replace('{n}', Math.round(perChat.tokensOut).toLocaleString())}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing reference */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2
              className="text-lg sm:text-xl font-bold text-white mb-1"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              {t('adm.plat.calc.ref.title')}
            </h2>
            <p className="text-xs text-zinc-500">
              {t('adm.plat.calc.ref.subtitle')}
            </p>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-zinc-600 whitespace-nowrap">
            {t('adm.plat.calc.ref.per1M')}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-zinc-500">
                <th className="text-start font-medium px-3 py-2">{t('adm.plat.calc.ref.provider')}</th>
                <th className="text-start font-medium px-3 py-2">{t('adm.plat.calc.ref.model')}</th>
                <th className="text-end font-medium px-3 py-2">{t('adm.plat.calc.ref.input')}</th>
                <th className="text-end font-medium px-3 py-2">{t('adm.plat.calc.ref.output')}</th>
                <th className="text-end font-medium px-3 py-2">{t('adm.plat.calc.ref.perChat')}</th>
              </tr>
            </thead>
            <tbody>
              {PRICING.map((p) => {
                const sim = simulateChat({
                  messagesPerChat: 6,
                  systemPromptTokens: DEFAULTS.systemPromptTokens,
                  customerMsgTokens: DEFAULTS.customerMsgTokens,
                  agentReplyTokens: DEFAULTS.agentReplyTokens,
                  visionFraction: 0.15,
                  voiceFraction: 0.05,
                  inputPer1M: p.inputPer1M,
                  outputPer1M: p.outputPer1M,
                });
                const credits = creditPeg > 0 ? sim.perChatUSD / creditPeg : 0;
                return (
                  <tr key={`${p.provider}-${p.model}`} className="border-b border-white/5 last:border-b-0">
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${PROVIDER_COLOR[p.provider] || ''}`}>
                        {p.provider}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-xs text-zinc-200">{p.model}</span>
                      {p.noteKey && <span className="ms-2 text-[10px] text-zinc-500">— {t(p.noteKey)}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-end font-mono text-xs text-zinc-300">
                      ${p.inputPer1M.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-end font-mono text-xs text-zinc-300">
                      ${p.outputPer1M.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-end">
                      <span className="font-mono text-xs text-emerald-300">{fmtUSD(sim.perChatUSD)}</span>
                      <span className="block text-[10px] text-emerald-400/60">
                        {fmtCredits(credits)} {t('adm.plat.calc.credits')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-zinc-600 mt-3">
          {t('adm.plat.calc.ref.footnote')}
        </p>
      </div>

      {/* How credits work */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 sm:p-5">
        <p className="text-xs sm:text-sm text-blue-200 font-semibold mb-2">{t('adm.plat.calc.how.title')}</p>
        <ul className="space-y-1.5 text-xs text-blue-100/80 leading-relaxed">
          <li>
            • {t('adm.plat.calc.how.1')}
          </li>
          <li>
            • {t('adm.plat.calc.how.2')}
          </li>
          <li>
            • {t('adm.plat.calc.how.3a')}<span className="font-mono">gpt-4o-mini</span>, <span className="font-mono">gemini-1.5-flash</span>, <span className="font-mono">llama-3.1-8b-instant</span>{t('adm.plat.calc.how.3b')}
          </li>
          <li>
            • {t('adm.plat.calc.how.4a')} <span className="font-mono">creditsUsed ≥ creditsLimit</span>, {t('adm.plat.calc.how.4b')}
          </li>
        </ul>
      </div>
    </div>
  );
}

function Slider({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  suffix: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</label>
        <span className="font-mono text-xs text-white tabular-nums">
          {value.toLocaleString()}
          <span className="text-zinc-500">{suffix}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-emerald-400"
      />
      {hint && <p className="text-[10px] text-zinc-600 mt-1">{hint}</p>}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 block">{label}</label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
        className="w-full px-2 py-1.5 bg-black/60 border border-white/10 focus:border-white/30 rounded-md text-xs text-white focus:outline-none font-mono"
      />
      {hint && <p className="text-[9px] text-zinc-600 mt-0.5">{hint}</p>}
    </div>
  );
}
