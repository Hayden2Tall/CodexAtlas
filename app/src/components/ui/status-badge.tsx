import { formatStatusLabel } from "@/lib/utils/translation";

const statusColors: Record<string, string> = {
  draft: "bg-gray-50 text-gray-600 border-gray-200",
  published: "bg-green-50 text-green-700 border-green-200",
  superseded: "bg-yellow-50 text-yellow-700 border-yellow-200",
  disputed: "bg-red-50 text-red-700 border-red-200",
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const classes = statusColors[status] ?? statusColors.draft;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${classes}`}
    >
      {formatStatusLabel(status)}
    </span>
  );
}
