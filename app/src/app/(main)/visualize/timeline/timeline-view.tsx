"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface ManuscriptPoint {
  id: string;
  title: string;
  language: string;
  dateStart: number | null;
  dateEnd: number | null;
  passageCount: number;
}

interface TimelineViewProps {
  manuscripts: ManuscriptPoint[];
}

const LANGUAGE_COLORS: Record<string, string> = {
  grc: "#3b82f6",
  heb: "#10b981",
  lat: "#8b5cf6",
  syc: "#f59e0b",
  cop: "#ec4899",
  eth: "#06b6d4",
  arm: "#f97316",
  geo: "#84cc16",
  ara: "#ef4444",
};

function getColor(lang: string): string {
  return LANGUAGE_COLORS[lang] ?? "#6b7280";
}

function formatYear(y: number): string {
  return y < 0 ? `${Math.abs(y)} BCE` : `${y} CE`;
}

export function TimelineView({ manuscripts }: TimelineViewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { minYear, maxYear, items } = useMemo(() => {
    const dates = manuscripts.flatMap((m) =>
      [m.dateStart, m.dateEnd].filter((d): d is number => d != null)
    );
    const min = Math.min(...dates);
    const max = Math.max(...dates);
    const padding = Math.max(50, Math.round((max - min) * 0.05));
    return {
      minYear: min - padding,
      maxYear: max + padding,
      items: manuscripts,
    };
  }, [manuscripts]);

  const range = maxYear - minYear || 1;

  function yearToPercent(year: number): number {
    return ((year - minYear) / range) * 100;
  }

  const ticks = useMemo(() => {
    const step = range > 2000 ? 500 : range > 1000 ? 200 : range > 400 ? 100 : 50;
    const start = Math.ceil(minYear / step) * step;
    const result: number[] = [];
    for (let y = start; y <= maxYear; y += step) result.push(y);
    return result;
  }, [minYear, maxYear, range]);

  const selected = selectedId ? items.find((m) => m.id === selectedId) : null;

  const languages = useMemo(() => {
    const set = new Set(items.map((m) => m.language));
    return [...set].sort();
  }, [items]);

  return (
    <div>
      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-3">
        {languages.map((lang) => (
          <span key={lang} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getColor(lang) }} />
            {lang.toUpperCase()}
          </span>
        ))}
      </div>

      {/* Desktop: horizontal scrollable timeline */}
      <div className="hidden md:block">
        <div className="relative overflow-x-auto rounded-lg border border-gray-200 bg-white p-6" style={{ minHeight: 200 }}>
          {/* Tick marks */}
          <div className="relative h-1 bg-gray-200" style={{ minWidth: Math.max(800, items.length * 30) }}>
            {ticks.map((y) => (
              <div
                key={y}
                className="absolute -top-5 -translate-x-1/2 text-[10px] text-gray-400"
                style={{ left: `${yearToPercent(y)}%` }}
              >
                {formatYear(y)}
                <div className="mx-auto mt-1 h-3 w-px bg-gray-300" />
              </div>
            ))}

            {/* Manuscript dots */}
            {items.map((m) => {
              const midYear = m.dateStart != null && m.dateEnd != null
                ? (m.dateStart + m.dateEnd) / 2
                : m.dateStart ?? m.dateEnd ?? 0;
              const left = yearToPercent(midYear);
              const isActive = hoveredId === m.id || selectedId === m.id;

              return (
                <button
                  key={m.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform"
                  style={{
                    left: `${left}%`,
                    top: "50%",
                    zIndex: isActive ? 20 : 10,
                    transform: `translate(-50%, -50%) scale(${isActive ? 1.5 : 1})`,
                  }}
                  onMouseEnter={() => setHoveredId(m.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => setSelectedId(selectedId === m.id ? null : m.id)}
                  aria-label={`${m.title} (${formatYear(midYear)})`}
                >
                  <span
                    className="block h-3 w-3 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: getColor(m.language) }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile: vertical list */}
      <div className="space-y-2 md:hidden">
        {items.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelectedId(selectedId === m.id ? null : m.id)}
            className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
              selectedId === m.id ? "border-primary-300 bg-primary-50" : "border-gray-200 bg-white"
            }`}
          >
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: getColor(m.language) }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{m.title}</p>
              <p className="text-xs text-gray-500">
                {m.dateStart != null ? formatYear(m.dateStart) : "?"} – {m.dateEnd != null ? formatYear(m.dateEnd) : "?"}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Selected detail card */}
      {selected && (
        <div className="mt-4 rounded-lg border border-primary-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif text-lg font-semibold text-gray-900">{selected.title}</h3>
              <p className="mt-0.5 text-sm text-gray-600">
                {selected.dateStart != null ? formatYear(selected.dateStart) : "?"} – {selected.dateEnd != null ? formatYear(selected.dateEnd) : "?"}
                <span className="ml-2 text-gray-400">{selected.language.toUpperCase()}</span>
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {selected.passageCount} passage{selected.passageCount !== 1 ? "s" : ""}
              </p>
            </div>
            <Link
              href={`/manuscripts/${selected.id}`}
              className="shrink-0 rounded-lg border border-primary-200 px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-50"
            >
              View manuscript
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
