/**
 * Token prices, USD per 1,000,000 tokens.
 *
 * VERIFY THESE against the provider's pricing page before trusting the totals
 * shown to HR — they are here so a run reports roughly what it cost, not for
 * billing. Unknown models fall back to a deliberately high rate so cost is
 * over- rather than under-stated.
 */
export const PRICING_UPDATED = "2026-08-18";

export type Rate = { input: number; output: number };

export const PRICING: Record<string, Rate> = {
  // ⚠️ UNVERIFIED — placeholder at gemini-2.5-flash rates. This is the model the
  // pipeline actually runs on, so replace it with the real figure from Google's
  // pricing page; until then the cost column is indicative only.
  "gemini-3.7-flash": { input: 0.3, output: 2.5 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-5.6-luna": { input: 0.2, output: 1.2 },
};

const DEFAULT_RATE: Rate = { input: 2.5, output: 10 };

export function rateFor(model: string): Rate {
  if (PRICING[model]) return PRICING[model];
  // Providers return dated or prefixed ids ("models/gemini-2.0-flash-001").
  const base = model.replace(/^models\//, "").replace(/-\d{3,}$/, "");
  return PRICING[base] ?? DEFAULT_RATE;
}

export function costUsd(model: string, promptTokens: number, completionTokens: number): number {
  const r = rateFor(model);
  return (promptTokens * r.input + completionTokens * r.output) / 1_000_000;
}
