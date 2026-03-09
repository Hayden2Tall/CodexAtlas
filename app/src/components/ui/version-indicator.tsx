interface VersionIndicatorProps {
  version: number;
  isCurrent?: boolean;
}

export function VersionIndicator({
  version,
  isCurrent = false,
}: VersionIndicatorProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-mono font-medium ${
        isCurrent
          ? "bg-primary-700 text-white"
          : "bg-gray-100 text-gray-600"
      }`}
    >
      v{version}
      {isCurrent && (
        <span className="ml-1 text-[10px] opacity-80">current</span>
      )}
    </span>
  );
}
