"use client";

import { useState } from "react";
import { getLanguageName } from "@/lib/utils/languages";

interface DiscoveredPassage {
  reference: string;
  original_text: string | null;
  description: string;
}

interface DiscoveredManuscript {
  title: string;
  original_language: string;
  estimated_date_start: number | null;
  estimated_date_end: number | null;
  origin_location: string | null;
  archive_location: string | null;
  archive_identifier: string | null;
  description: string;
  historical_context: string;
  suggested_passages: DiscoveredPassage[];
  confidence_notes: string;
  already_exists: boolean;
}

interface IngestResult {
  title: string;
  success: boolean;
  manuscriptId?: string;
  passagesCreated?: number;
  error?: string;
}

const EXAMPLE_QUERIES = [
  "Early Greek New Testament manuscripts",
  "Dead Sea Scrolls - biblical texts",
  "Ancient Egyptian funerary texts",
  "Medieval Latin biblical manuscripts",
  "Early Syriac Christian manuscripts",
];

export function DiscoveryPanel() {
  const [query, setQuery] = useState("");
  const [maxResults, setMaxResults] = useState(5);
  const [isSearching, setIsSearching] = useState(false);
  const [manuscripts, setManuscripts] = useState<DiscoveredManuscript[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [ingestResults, setIngestResults] = useState<Map<string, IngestResult>>(
    new Map()
  );
  const [costInfo, setCostInfo] = useState<{
    tokens_input: number;
    tokens_output: number;
    estimated_cost_usd: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSearch() {
    if (!query.trim() || query.trim().length < 3) return;

    setIsSearching(true);
    setManuscripts([]);
    setIngestResults(new Map());
    setCostInfo(null);
    setErrorMessage("");
    setExpandedIdx(null);

    try {
      const res = await fetch("/api/agent/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), max_results: maxResults }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error ?? "Discovery failed");
        setIsSearching(false);
        return;
      }

      setManuscripts(data.manuscripts ?? []);
      setCostInfo(data.usage ?? null);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Network error"
      );
    }

    setIsSearching(false);
  }

  async function handleIngest(ms: DiscoveredManuscript) {
    const key = ms.title;
    setIngestResults((prev) => {
      const next = new Map(prev);
      next.set(key, { title: ms.title, success: false });
      return next;
    });

    try {
      const res = await fetch("/api/agent/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: ms.title,
          original_language: ms.original_language,
          estimated_date_start: ms.estimated_date_start,
          estimated_date_end: ms.estimated_date_end,
          origin_location: ms.origin_location,
          archive_location: ms.archive_location,
          archive_identifier: ms.archive_identifier,
          description: ms.description,
          historical_context: ms.historical_context,
          passages: ms.suggested_passages,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setIngestResults((prev) => {
          const next = new Map(prev);
          next.set(key, {
            title: ms.title,
            success: true,
            manuscriptId: data.manuscript?.id,
            passagesCreated: data.passages_created,
          });
          return next;
        });
      } else {
        setIngestResults((prev) => {
          const next = new Map(prev);
          next.set(key, {
            title: ms.title,
            success: false,
            error: data.error ?? `HTTP ${res.status}`,
          });
          return next;
        });
      }
    } catch (err) {
      setIngestResults((prev) => {
        const next = new Map(prev);
        next.set(key, {
          title: ms.title,
          success: false,
          error: err instanceof Error ? err.message : "Network error",
        });
        return next;
      });
    }
  }

  async function handleIngestAll() {
    const toIngest = manuscripts.filter(
      (m) => !m.already_exists && !ingestResults.has(m.title)
    );
    for (const ms of toIngest) {
      await handleIngest(ms);
    }
  }

  function formatDate(start: number | null, end: number | null): string {
    if (!start && !end) return "Unknown date";
    const fmt = (n: number) => (n < 0 ? `${Math.abs(n)} BCE` : `${n} CE`);
    if (start && end) return `${fmt(start)}\u2013${fmt(end)}`;
    return `c. ${fmt(start ?? end!)}`;
  }

  const newManuscripts = manuscripts.filter(
    (m) => !m.already_exists && !ingestResults.has(m.title)
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-700">
        Manuscript Discovery
      </h2>
      <p className="mt-1 text-xs text-gray-500">
        Use AI to research and suggest manuscripts. Approve results to add them
        to the library with passages.
      </p>

      {/* Search controls */}
      <div className="mt-4 space-y-3">
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isSearching && handleSearch()}
            placeholder="e.g., Early Greek New Testament manuscripts"
            className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            disabled={isSearching}
          />
          <select
            value={maxResults}
            onChange={(e) => setMaxResults(Number(e.target.value))}
            disabled={isSearching}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value={3}>3 results</option>
            <option value={5}>5 results</option>
            <option value={8}>8 results</option>
          </select>
          <button
            onClick={handleSearch}
            disabled={isSearching || query.trim().length < 3}
            className="rounded-md bg-primary-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-800 transition-colors disabled:opacity-50"
          >
            {isSearching ? "Searching..." : "Discover"}
          </button>
        </div>

        {/* Example queries */}
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-gray-400">Try:</span>
          {EXAMPLE_QUERIES.map((eq) => (
            <button
              key={eq}
              onClick={() => setQuery(eq)}
              className="rounded-full border border-gray-200 px-2.5 py-0.5 text-xs text-gray-500 hover:border-primary-300 hover:text-primary-600 transition-colors"
            >
              {eq}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {errorMessage && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Cost info */}
      {costInfo && (
        <div className="mt-4 flex gap-4 text-xs text-gray-500">
          <span>Discovery cost: ${costInfo.estimated_cost_usd.toFixed(4)}</span>
          <span>
            Tokens: {formatTokens(costInfo.tokens_input)} in /{" "}
            {formatTokens(costInfo.tokens_output)} out
          </span>
        </div>
      )}

      {/* Results */}
      {manuscripts.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              Found {manuscripts.length} manuscript
              {manuscripts.length !== 1 ? "s" : ""}
              {manuscripts.some((m) => m.already_exists) && (
                <span className="ml-1 text-xs font-normal text-gray-400">
                  ({manuscripts.filter((m) => m.already_exists).length} already
                  in library)
                </span>
              )}
            </p>
            {newManuscripts.length > 1 && (
              <button
                onClick={handleIngestAll}
                className="rounded-md border border-primary-300 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100 transition-colors"
              >
                Add All New ({newManuscripts.length})
              </button>
            )}
          </div>

          <div className="divide-y divide-gray-100 rounded-md border border-gray-100">
            {manuscripts.map((ms, idx) => {
              const result = ingestResults.get(ms.title);
              const isExpanded = expandedIdx === idx;

              return (
                <div key={`${ms.title}-${idx}`} className="p-4">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() =>
                        setExpandedIdx(isExpanded ? null : idx)
                      }
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setExpandedIdx(isExpanded ? null : idx);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900">
                          {ms.title}
                        </h3>
                        {ms.already_exists && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Already in library
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                        <span>{getLanguageName(ms.original_language)}</span>
                        <span>
                          {formatDate(
                            ms.estimated_date_start,
                            ms.estimated_date_end
                          )}
                        </span>
                        {ms.origin_location && <span>{ms.origin_location}</span>}
                        {ms.suggested_passages.length > 0 && (
                          <span>
                            {ms.suggested_passages.length} passage
                            {ms.suggested_passages.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-gray-600 line-clamp-2">
                        {ms.description}
                      </p>
                    </div>

                    {/* Action button */}
                    <div className="shrink-0">
                      {result?.success ? (
                        <a
                          href={`/manuscripts/${result.manuscriptId}`}
                          className="inline-block rounded-md bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700"
                        >
                          Added ({result.passagesCreated} passages)
                        </a>
                      ) : result?.error ? (
                        <span className="text-xs text-red-600">
                          {result.error}
                        </span>
                      ) : result && !result.success && !result.error ? (
                        <span className="text-xs text-gray-400">
                          Adding...
                        </span>
                      ) : ms.already_exists ? (
                        <span className="text-xs text-gray-400">
                          Exists
                        </span>
                      ) : (
                        <button
                          onClick={() => handleIngest(ms)}
                          className="rounded-md bg-primary-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-800 transition-colors"
                        >
                          Add to Library
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
                      {ms.historical_context && (
                        <div>
                          <p className="text-xs font-medium text-gray-500">
                            Historical Context
                          </p>
                          <p className="mt-0.5 text-xs text-gray-700">
                            {ms.historical_context}
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {ms.archive_location && (
                          <div>
                            <span className="font-medium text-gray-500">
                              Archive:{" "}
                            </span>
                            <span className="text-gray-700">
                              {ms.archive_location}
                            </span>
                          </div>
                        )}
                        {ms.archive_identifier && (
                          <div>
                            <span className="font-medium text-gray-500">
                              Identifier:{" "}
                            </span>
                            <span className="text-gray-700">
                              {ms.archive_identifier}
                            </span>
                          </div>
                        )}
                      </div>

                      {ms.confidence_notes && (
                        <div className="rounded-md bg-blue-50 p-2">
                          <p className="text-xs font-medium text-blue-700">
                            Confidence Notes
                          </p>
                          <p className="mt-0.5 text-xs text-blue-600">
                            {ms.confidence_notes}
                          </p>
                        </div>
                      )}

                      {ms.suggested_passages.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-500">
                            Suggested Passages
                          </p>
                          <div className="mt-1 space-y-1.5">
                            {ms.suggested_passages.map((p, pi) => (
                              <div
                                key={`${p.reference}-${pi}`}
                                className="rounded-md border border-gray-100 bg-gray-50 p-2"
                              >
                                <p className="text-xs font-medium text-gray-700">
                                  {p.reference}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {p.description}
                                </p>
                                {p.original_text && (
                                  <p className="mt-1 font-mono text-xs text-gray-600 line-clamp-3">
                                    {p.original_text}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isSearching && (
        <div className="mt-6 flex items-center justify-center gap-2 py-8">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-300 border-t-primary-700" />
          <span className="text-sm text-gray-500">
            Researching manuscripts...
          </span>
        </div>
      )}
    </div>
  );
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return count.toString();
}
