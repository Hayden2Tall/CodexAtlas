/**
 * AI model cost estimation.
 *
 * Prices are per-million tokens. Update when models or pricing change.
 * Source: https://docs.anthropic.com/en/docs/about-claude/models
 */

interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-sonnet-4-20250514": { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  "claude-haiku-3-20240307": { inputPerMillion: 0.25, outputPerMillion: 1.25 },
  "claude-3-5-sonnet-20241022": { inputPerMillion: 3.0, outputPerMillion: 15.0 },
};

const DEFAULT_PRICING: ModelPricing = { inputPerMillion: 3.0, outputPerMillion: 15.0 };

export function estimateCostUsd(
  model: string,
  tokensInput: number,
  tokensOutput: number
): number {
  const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING;
  const inputCost = (tokensInput / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (tokensOutput / 1_000_000) * pricing.outputPerMillion;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}

export function formatCostUsd(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

export function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return count.toString();
}
