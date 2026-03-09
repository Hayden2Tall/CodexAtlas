export function formatManuscriptDate(
  start: number | null,
  end: number | null,
): string {
  if (start == null && end == null) return "Unknown";

  const formatYear = (year: number): string => {
    if (year < 0) return `${Math.abs(year)} BCE`;
    return `${year} CE`;
  };

  if (start != null && end != null) {
    if (start < 0 && end < 0) {
      return `${Math.abs(start)}–${Math.abs(end)} BCE`;
    }
    if (start >= 0 && end >= 0) {
      return `${start}–${end} CE`;
    }
    return `${formatYear(start)} – ${formatYear(end)}`;
  }

  if (start != null) return formatYear(start);
  return formatYear(end!);
}
