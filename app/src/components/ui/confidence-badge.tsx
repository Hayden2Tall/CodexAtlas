import {
  getConfidenceLabel,
  getConfidenceColor,
} from "@/lib/utils/translation";

const colorMap: Record<string, string> = {
  blue: "bg-confidence-high/15 text-confidence-high border-confidence-high/30",
  green:
    "bg-confidence-good/15 text-confidence-good border-confidence-good/30",
  yellow:
    "bg-confidence-fair/15 text-confidence-fair border-confidence-fair/30",
  orange:
    "bg-confidence-medium/15 text-confidence-medium border-confidence-medium/30",
  red: "bg-confidence-low/15 text-confidence-low border-confidence-low/30",
};

interface ConfidenceBadgeProps {
  score: number;
  showScore?: boolean;
}

export function ConfidenceBadge({
  score,
  showScore = true,
}: ConfidenceBadgeProps) {
  const color = getConfidenceColor(score);
  const label = getConfidenceLabel(score);
  const classes = colorMap[color] ?? colorMap.red;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${classes}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label}
      {showScore && (
        <span className="opacity-70">({Math.round(score * 100)}%)</span>
      )}
    </span>
  );
}
