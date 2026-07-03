// USD per 1M tokens — same source as the admin Pricing Calculator
// (each provider's public pricing page, Jan 2026). Keep both in sync.
export interface ModelPricing {
  provider: string;
  model: string;
  inputPer1M: number;
  outputPer1M: number;
}

export const MODEL_PRICING: ModelPricing[] = [
  { provider: 'openai', model: 'gpt-4o', inputPer1M: 2.5, outputPer1M: 10 },
  { provider: 'openai', model: 'gpt-4o-mini', inputPer1M: 0.15, outputPer1M: 0.6 },
  { provider: 'openai', model: 'gpt-4-turbo', inputPer1M: 10, outputPer1M: 30 },
  { provider: 'openai', model: 'gpt-3.5-turbo', inputPer1M: 0.5, outputPer1M: 1.5 },
  { provider: 'openai', model: 'o1', inputPer1M: 15, outputPer1M: 60 },
  { provider: 'openai', model: 'o1-mini', inputPer1M: 3, outputPer1M: 12 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', inputPer1M: 3, outputPer1M: 15 },
  { provider: 'anthropic', model: 'claude-3-5-haiku-20241022', inputPer1M: 0.8, outputPer1M: 4 },
  { provider: 'anthropic', model: 'claude-3-opus-20240229', inputPer1M: 15, outputPer1M: 75 },
  { provider: 'google', model: 'gemini-2.0-flash', inputPer1M: 0.1, outputPer1M: 0.4 },
  { provider: 'google', model: 'gemini-1.5-pro', inputPer1M: 1.25, outputPer1M: 5 },
  { provider: 'google', model: 'gemini-1.5-flash', inputPer1M: 0.075, outputPer1M: 0.3 },
  { provider: 'groq', model: 'llama-3.3-70b-versatile', inputPer1M: 0.59, outputPer1M: 0.79 },
  { provider: 'groq', model: 'llama-3.1-8b-instant', inputPer1M: 0.05, outputPer1M: 0.08 },
  { provider: 'groq', model: 'mixtral-8x7b-32768', inputPer1M: 0.24, outputPer1M: 0.24 },
];

// Per-message assumptions (mirrors the admin calculator's Messenger e-commerce
// baseline): system prompt + catalog ≈ 1000 input tokens, customer message ≈ 60,
// agent reply ≈ 200 output tokens.
const INPUT_TOKENS_PER_MESSAGE = 1060;
const OUTPUT_TOKENS_PER_MESSAGE = 200;

/** Estimated API cost in USD for 1,000 answered messages on a given model. */
export function costPer1000Messages(model: string): number | null {
  const p = MODEL_PRICING.find((m) => m.model === model);
  if (!p) return null;
  const perMessage =
    (INPUT_TOKENS_PER_MESSAGE / 1_000_000) * p.inputPer1M +
    (OUTPUT_TOKENS_PER_MESSAGE / 1_000_000) * p.outputPer1M;
  return perMessage * 1000;
}

/** "≈ $0.32 / 1k msgs" style label, or null when the model is unknown. */
export function costPer1000Label(model: string): string | null {
  const usd = costPer1000Messages(model);
  if (usd === null) return null;
  const shown = usd < 1 ? `$${usd.toFixed(2)}` : usd < 10 ? `$${usd.toFixed(1)}` : `$${Math.round(usd)}`;
  return `≈ ${shown} / 1000 msgs`;
}
