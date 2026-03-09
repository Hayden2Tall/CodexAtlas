import { formatMethodLabel } from "@/lib/utils/translation";

const methodColors: Record<string, string> = {
  ai_initial: "bg-purple-50 text-purple-700 border-purple-200",
  ai_revised: "bg-indigo-50 text-indigo-700 border-indigo-200",
  human: "bg-emerald-50 text-emerald-700 border-emerald-200",
  hybrid: "bg-amber-50 text-amber-700 border-amber-200",
};

interface MethodBadgeProps {
  method: string;
}

export function MethodBadge({ method }: MethodBadgeProps) {
  const classes =
    methodColors[method] ?? "bg-gray-50 text-gray-700 border-gray-200";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${classes}`}
    >
      {formatMethodLabel(method)}
    </span>
  );
}
