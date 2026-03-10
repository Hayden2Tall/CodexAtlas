export function getConfidenceLabel(score: number): string {
  if (score >= 0.95) return "Very High";
  if (score >= 0.8) return "High";
  if (score >= 0.6) return "Fair";
  if (score >= 0.3) return "Low";
  return "Very Low";
}

export function getConfidenceExplanation(score: number): string {
  const pct = Math.round(score * 100);
  if (score >= 0.95)
    return `${pct}% — Very high confidence. The source text is well-attested and the translation closely matches established scholarly consensus.`;
  if (score >= 0.8)
    return `${pct}% — High confidence. The translation is reliable with minor uncertainties in word choice or phrasing.`;
  if (score >= 0.6)
    return `${pct}% — Fair confidence. Some passages have ambiguous meaning or the source text has known variants that affect translation.`;
  if (score >= 0.3)
    return `${pct}% — Low confidence. Significant uncertainty due to damaged text, rare vocabulary, or contested interpretation.`;
  return `${pct}% — Very low confidence. The source material is fragmentary or heavily debated among scholars.`;
}

export function getConfidenceColor(score: number): string {
  if (score >= 0.95) return "blue";
  if (score >= 0.8) return "green";
  if (score >= 0.6) return "yellow";
  if (score >= 0.3) return "orange";
  return "red";
}

export function formatMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    ai_initial: "AI Translation",
    ai_revised: "AI Revised",
    human: "Human Translation",
    hybrid: "Hybrid",
  };
  return labels[method] || method;
}

export function formatStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Draft",
    published: "Published",
    superseded: "Superseded",
    disputed: "Disputed",
  };
  return labels[status] || status;
}
