"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

type Significance = "all" | "major" | "minor" | "orthographic";

interface VariantItem {
  id: string;
  passage_reference: string;
  description: string | null;
  readingCount: number;
  significance: string;
  created_at: string;
  bookName: string;
  bookOrder: number;
}

interface VariantFiltersProps {
  variants: VariantItem[];
}

const SIGNIFICANCE_STYLES: Record<string, string> = {
  major: "bg-red-50 text-red-700 ring-red-200",
  minor: "bg-yellow-50 text-yellow-700 ring-yellow-200",
  orthographic: "bg-gray-50 text-gray-600 ring-gray-200",
};

function SignificanceBadge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${SIGNIFICANCE_STYLES[value] ?? SIGNIFICANCE_STYLES.minor}`}
    >
      {value}
    </span>
  );
}

export function VariantFilters({ variants }: VariantFiltersProps) {
  const [search, setSearch] = useState("");
  const [significance, setSignificance] = useState<Significance>("all");

  const filtered = useMemo(() => {
    let result = variants;
    if (significance !== "all") {
      result = result.filter((v) => v.significance === significance);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (v) =>
          v.passage_reference.toLowerCase().includes(q) ||
          v.description?.toLowerCase().includes(q) ||
          v.bookName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [variants, significance, search]);

  const grouped = useMemo(() => {
    const map = new Map<number, { bookName: string; items: VariantItem[] }>();
    for (const v of filtered) {
      let g = map.get(v.bookOrder);
      if (!g) {
        g = { bookName: v.bookName, items: [] };
        map.set(v.bookOrder, g);
      }
      g.items.push(v);
    }
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [filtered]);

  const counts = useMemo(() => {
    const c = { major: 0, minor: 0, orthographic: 0, total: variants.length };
    for (const v of variants) {
      if (v.significance === "major") c.major++;
      else if (v.significance === "orthographic") c.orthographic++;
      else c.minor++;
    }
    return c;
  }, [variants]);

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by reference or description…"
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div className="flex gap-1.5">
          {(["all", "major", "minor", "orthographic"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSignificance(s)}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                significance === s
                  ? "bg-primary-100 text-primary-800"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s === "all" ? `All (${counts.total})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${counts[s]})`}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          No variants match your filters.
        </p>
      ) : (
        <div className="space-y-8">
          {grouped.map(([order, group]) => (
            <section key={order}>
              <h2 className="mb-3 border-b border-gray-200 pb-2 font-serif text-lg font-semibold text-primary-900">
                {group.bookName}
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({group.items.length} variant{group.items.length !== 1 ? "s" : ""})
                </span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((v) => (
                  <Link
                    key={v.id}
                    href={`/variants/${v.id}`}
                    className="group rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 group-hover:text-primary-700">
                        {v.passage_reference}
                      </h3>
                      <SignificanceBadge value={v.significance} />
                    </div>
                    {v.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-gray-600">
                        {v.description}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                      <span>{v.readingCount} reading{v.readingCount !== 1 ? "s" : ""}</span>
                      <span>&middot;</span>
                      <time dateTime={v.created_at}>
                        {new Date(v.created_at).toLocaleDateString()}
                      </time>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
