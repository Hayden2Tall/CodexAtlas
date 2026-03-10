"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { getLanguageName } from "@/lib/utils/languages";

interface SearchResult {
  type: "manuscript" | "passage" | "translation";
  id: string;
  title: string;
  subtitle: string;
  snippet: string;
  href: string;
  language?: string;
  date_range?: string;
  confidence?: number;
}

type TypeFilter = "" | "manuscript" | "passage" | "translation";

const TYPE_STYLES: Record<string, string> = {
  manuscript: "bg-purple-100 text-purple-700",
  passage: "bg-blue-100 text-blue-700",
  translation: "bg-green-100 text-green-700",
};

const TYPE_LABELS: Record<string, string> = {
  manuscript: "Manuscript",
  passage: "Passage",
  translation: "Translation",
};

export function SearchInterface() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [total, setTotal] = useState(0);

  const doSearch = useCallback(
    async (q: string, type: TypeFilter) => {
      if (q.trim().length < 2) return;

      setIsSearching(true);
      setHasSearched(true);

      const params = new URLSearchParams({ q: q.trim(), limit: "30" });
      if (type) params.set("type", type);

      router.replace(`/search?q=${encodeURIComponent(q.trim())}`, {
        scroll: false,
      });

      try {
        const res = await fetch(`/api/search?${params}`);
        const data = await res.json();

        if (res.ok) {
          setResults(data.results ?? []);
          setTotal(data.total ?? 0);
        } else {
          setResults([]);
          setTotal(0);
        }
      } catch {
        setResults([]);
        setTotal(0);
      }

      setIsSearching(false);
    },
    [router]
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doSearch(query, typeFilter);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-primary-900">
          Search
        </h1>
        <p className="mt-1 text-gray-600">
          Find manuscripts, passages, and translations across the library.
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search manuscripts, passages, translations..."
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            autoFocus
          />
          <button
            type="submit"
            disabled={isSearching || query.trim().length < 2}
            className="rounded-lg bg-primary-700 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-800 transition-colors disabled:opacity-50"
          >
            {isSearching ? "Searching..." : "Search"}
          </button>
        </div>

        {/* Type filter */}
        <div className="flex gap-2">
          {(
            [
              ["", "All"],
              ["manuscript", "Manuscripts"],
              ["passage", "Passages"],
              ["translation", "Translations"],
            ] as [TypeFilter, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setTypeFilter(value);
                if (hasSearched) doSearch(query, value);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === value
                  ? "bg-primary-100 text-primary-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </form>

      {/* Results */}
      {isSearching && (
        <div className="mt-8 flex items-center justify-center gap-2 py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-300 border-t-primary-700" />
          <span className="text-sm text-gray-500">Searching...</span>
        </div>
      )}

      {!isSearching && hasSearched && (
        <div className="mt-6">
          <p className="mb-4 text-sm text-gray-500">
            {total} result{total !== 1 ? "s" : ""} found
          </p>

          {results.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-200 py-12 text-center">
              <p className="text-gray-500">
                No results found for &ldquo;{query}&rdquo;
              </p>
              <p className="mt-1 text-sm text-gray-400">
                Try a different search term or broaden your filters.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((r) => (
                <Link
                  key={`${r.type}-${r.id}`}
                  href={r.href}
                  className="block rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-primary-300 hover:bg-primary-50/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[r.type]}`}
                        >
                          {TYPE_LABELS[r.type]}
                        </span>
                        <h3 className="truncate text-sm font-semibold text-gray-900">
                          {r.title}
                        </h3>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {r.subtitle}
                        {r.language && (
                          <span className="ml-2">
                            {getLanguageName(r.language)}
                          </span>
                        )}
                        {r.date_range && (
                          <span className="ml-2">{r.date_range}</span>
                        )}
                      </p>
                      {r.snippet && (
                        <p className="mt-1.5 line-clamp-2 text-xs text-gray-600">
                          {r.snippet}
                        </p>
                      )}
                    </div>
                    {r.confidence != null && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        {Math.round(r.confidence * 100)}%
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
