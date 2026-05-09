'use client';

import { useMemo, useState } from 'react';

// USD per 1M tokens. Source: each provider's public pricing page (Jan 2026).
// Update these values when providers change pricing.
interface ModelPricing {
  provider: string;
  model: string;
  inputPer1M: number;
  outputPer1M: number;
  notes?: string;
}

const PRICING: ModelPricing[] = [
  // OpenAI
  { provider: 'openai', model: 'gpt-4o', inputPer1M: 2.5, outputPer1M: 10 },
  { provider: 'openai', model: 'gpt-4o-mini', inputPer1M: 0.15, outputPer1M: 0.6, notes: 'cheapest vision-capable' },
  { provider: 'openai', model: 'gpt-4-turbo', inputPer1M: 10, outputPer1M: 30 },
  { provider: 'openai', model: 'gpt-3.5-turbo', inputPer1M: 0.5, outputPer1M: 1.5 },
  { provider: 'openai', model: 'o1', inputPer1M: 15, outputPer1M: 60, notes: 'reasoning' },
  { provider: 'openai', model: 'o1-mini', inputPer1M: 3, outputPer1M: 12, notes: 'reasoning' },
  // Anthropic
  { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', inputPer1M: 3, outputPer1M: 15 },
  { provider: 'anthropic', model: 'claude-3-5-haiku-20241022', inputPer1M: 0.8, outputPer1M: 4 },
  { provider: 'anthropic', model: 'claude-3-opus-20240229', inputPer1M: 15, outputPer1M: 75 },
  // Google
  { provider: 'google', model: 'gemini-2.0-flash', inputPer1M: 0.1, outputPer1M: 0.4, notes: 'free tier available' },
  { provider: 'google', model: 'gemini-1.5-pro', inputPer1M: 1.25, outputPer1M: 5 },
  { provider: 'google', model: 'gemini-1.5-flash', inputPer1M: 0.075, outputPer1M: 0.3 },
  // Groq
  { provider: 'groq', model: 'llama-3.3-70b-versatile', inputPer1M: 0.59, outputPer1M: 0.79 },
  { provider: 'groq', model: 'llama-3.1-8b-instant', inputPer1M: 0.05, outputPer1M: 0.08, notes: 'cheapest overall' },
  { provider: 'groq', model: 'mixtral-8x7b-32768', inputPer1M: 0.24, outputPer1M: 0.24 },
];

// Credit:USD peg — 1 credit = $0.001 (i.e. 1 credit = 0.1 cents)
// Tweak this single number to change pricing globally.
const USD_PER_CREDIT = 0.001;

const PRESETS = [
  { label: 'Short chat reply', input: 400, output: 150, hint: 'typical customer Q&A' },
  { label: 'Long chat reply', input: 800, output: 400, hint: 'detailed product question' },
  { label: 'Vision analyze (one product)', input: 1200, output: 200, hint: 'image + caption → product' },
  { label: 'Generate AI agent (full inbox)', input: 8000, output: 1000, hint: 'reads ~25 conversations' },
  { label: 'Page post analysis (30 posts)', input: 12000, output: 1500, hint: 'scans recent posts' },
];

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
  return `$${usd.toFixed(2)}`;
}

function fmtCredits(credits: number): string {
  if (credits < 1) return credits.toFixed(2);
  if (credits < 100) return credits.toFixed(1);
  return Math.round(credits).toLocaleString();
}

export default function PricingCalculator() {
  const [model, setModel] = useState<string>('gpt-4o-mini');
  const [inputTokens, setInputTokens] = useState<number>(400);
  const [outputTokens, setOutputTokens] = useState<number>(150);
  const [creditPeg, setCreditPeg] = useState<number>(USD_PER_CREDIT);

  const selected = PRICING.find((p) => p.model === model) || PRICING[0];

  const usd = useMemo(() => {
    const inputCost = (inputTokens / 1_000_000) * selected.inputPer1M;
    const outputCost = (outputTokens / 1_000_000) * selected.outputPer1M;
    return inputCost + outputCost;
  }, [inputTokens, outputTokens, selected]);

  const credits = creditPeg > 0 ? usd / creditPeg : 0;

  const monthlyAtPlan = (planCredits: number) =>
    credits > 0 ? Math.floor(planCredits / credits) : Infinity;

  return (
    <div className="space-y-6">
      {/* Pricing reference */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2
              className="text-lg sm:text-xl font-bold text-white mb-1"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              Model pricing
            </h2>
            <p className="text-xs text-zinc-500">
              Public token rates from each provider. Used to compute the USD cost of every AI call.
            </p>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-zinc-600 whitespace-nowrap">
            per 1M tokens
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-zinc-500">
                <th className="text-start font-medium px-3 py-2">Provider</th>
                <th className="text-start font-medium px-3 py-2">Model</th>
                <th className="text-end font-medium px-3 py-2">Input</th>
                <th className="text-end font-medium px-3 py-2">Output</th>
                <th className="text-end font-medium px-3 py-2">Reply cost*</th>
              </tr>
            </thead>
            <tbody>
              {PRICING.map((p) => {
                const replyUSD = (400 / 1e6) * p.inputPer1M + (150 / 1e6) * p.outputPer1M;
                const replyCredits = creditPeg > 0 ? replyUSD / creditPeg : 0;
                return (
                  <tr key={`${p.provider}-${p.model}`} className="border-b border-white/5 last:border-b-0">
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${PROVIDER_COLOR[p.provider] || ''}`}>
                        {p.provider}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-xs text-zinc-200">{p.model}</span>
                      {p.notes && <span className="ms-2 text-[10px] text-zinc-500">— {p.notes}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-end font-mono text-xs text-zinc-300">
                      ${p.inputPer1M.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-end font-mono text-xs text-zinc-300">
                      ${p.outputPer1M.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-end">
                      <span className="font-mono text-xs text-emerald-300">{fmtUSD(replyUSD)}</span>
                      <span className="block text-[10px] text-emerald-400/60">
                        {fmtCredits(replyCredits)} credits
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-zinc-600 mt-3">
          *Reply cost = 400 input + 150 output tokens (typical customer Q&amp;A). At {fmtUSD(creditPeg)}/credit.
        </p>
      </div>

      {/* Calculator */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-5 sm:p-6">
        <div className="mb-4">
          <h2
            className="text-lg sm:text-xl font-bold text-white mb-1"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Calculator
          </h2>
          <p className="text-xs text-zinc-500">
            Pick a model and enter expected token counts, or click a preset.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Inputs */}
          <div className="md:col-span-2 space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 block">
                Model
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
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 block">
                  Input tokens
                </label>
                <input
                  type="number"
                  min={0}
                  value={inputTokens}
                  onChange={(e) => setInputTokens(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/30 rounded-lg text-sm text-white focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 block">
                  Output tokens
                </label>
                <input
                  type="number"
                  min={0}
                  value={outputTokens}
                  onChange={(e) => setOutputTokens(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3 py-2 bg-black/60 border border-white/10 focus:border-white/30 rounded-lg text-sm text-white focus:outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 block">
                Presets
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => {
                      setInputTokens(p.input);
                      setOutputTokens(p.output);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 transition-colors"
                    title={p.hint}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 block">
                Credit peg (USD per 1 credit)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 text-sm">$</span>
                <input
                  type="number"
                  step="0.0001"
                  min={0}
                  value={creditPeg}
                  onChange={(e) => setCreditPeg(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-32 px-3 py-2 bg-black/60 border border-white/10 focus:border-white/30 rounded-lg text-sm text-white focus:outline-none font-mono"
                />
                <span className="text-[11px] text-zinc-500">
                  default $0.001 → 1 cent buys 10 credits
                </span>
              </div>
            </div>
          </div>

          {/* Result */}
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-emerald-400/70 mb-1">USD cost</p>
              <p
                className="text-2xl font-bold text-emerald-300"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                {fmtUSD(usd)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-emerald-400/70 mb-1">Credits</p>
              <p
                className="text-2xl font-bold text-white"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                {fmtCredits(credits)}
              </p>
            </div>
            <div className="pt-3 border-t border-emerald-500/20 space-y-1.5 text-[11px]">
              <div className="flex justify-between text-zinc-400">
                <span>500-credit plan</span>
                <span className="font-mono text-emerald-300">
                  ~{monthlyAtPlan(500).toLocaleString()} ops
                </span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>5,000-credit plan</span>
                <span className="font-mono text-emerald-300">
                  ~{monthlyAtPlan(5000).toLocaleString()} ops
                </span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>50,000-credit plan</span>
                <span className="font-mono text-emerald-300">
                  ~{monthlyAtPlan(50000).toLocaleString()} ops
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How credits work */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 sm:p-5">
        <p className="text-xs sm:text-sm text-blue-200 font-semibold mb-2">How credits work</p>
        <ul className="space-y-1.5 text-xs text-blue-100/80 leading-relaxed">
          <li>
            • Every AI call (chat reply, vision analyze, agent generation) returns a <span className="font-mono text-blue-200">usage</span> object with input/output token counts.
          </li>
          <li>
            • The merchant&apos;s plan grants a fixed number of <strong>credits</strong> per month (column 3 below would be the plan&apos;s pool).
          </li>
          <li>
            • Each call deducts <span className="font-mono text-blue-200">USD cost ÷ credit peg</span> credits from <span className="font-mono text-blue-200">User.creditsUsed</span>.
          </li>
          <li>
            • When <span className="font-mono text-blue-200">creditsUsed ≥ creditsLimit</span>, the AI agent stops replying until next billing cycle (or upgrade).
          </li>
          <li>
            • Cheap models like <span className="font-mono">gpt-4o-mini</span> or <span className="font-mono">gemini-1.5-flash</span> stretch the free 500 credits to thousands of replies.
          </li>
        </ul>
      </div>
    </div>
  );
}
