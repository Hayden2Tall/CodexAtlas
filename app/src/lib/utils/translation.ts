export function getConfidenceLabel(score: number): string {
  if (score >= 0.95) return "Very High";
  if (score >= 0.8) return "High";
  if (score >= 0.6) return "Fair";
  if (score >= 0.3) return "Low";
  return "Very Low";
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
