"use client";

import { useState, useCallback } from "react";
import { ApiKeyError } from "@/components/ui/api-key-error";

interface CrossManuscriptContent {
  comparative_overview: string;
  manuscripts_compared: string[];
  areas_of_agreement: string;
  notable_divergences: string;
  textual_implications: string;
}

interface CrossManuscriptSummaryProps {
  book: string;
  chapter: number;
  manuscriptCount: number;
  cachedSummary: CrossManuscriptContent | null;
  isAuthenticated: boolean;
}

export function CrossManuscriptSummary({
  book,
  chapter,
  manuscriptCount,
  cachedSummary,
  isAuthenticated,
}: CrossManuscriptSummaryProps) {
  const [summary, setSummary] = useState<CrossManuscriptContent | null>(cachedSummary);
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async (force = false) => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/summaries/cross-manuscript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ book, chapter, ...(force && { force: true }) }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to generate cross-manuscript summary");
      }
      const data = await res.json();
      setSummary(data.summary);
      setExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate summary");
    } finally {
      setGenerating(false);
    }
  }, [book, chapter]);

  // Only meaningful with 2+ manuscripts
  if (manuscriptCount < 2 && !summary) return null;
  if (!summary && !isAuthenticated) return null;

  return (
    <div className="mb-8 rounded-xl border border-purple-100 dark:border-purple-800/50 bg-purple-50/40 dark:bg-purple-900/10 px-5 py-4">
      {summary ? (
        <details
          className="group"
          open={expanded}
          onToggle={(e) => setExpanded((e.target as HTMLDetailsElement).open)}
        >
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-purple-800 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-200">
            <svg
              className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Cross-manuscript comparison
            <span className="ml-1 rounded-full bg-purple-100 dark:bg-purple-900/50 px-1.5 py-0 text-[9px] font-semibold uppercase text-purple-600 dark:text-purple-400 ring-1 ring-inset ring-purple-300 dark:ring-purple-700">
              {summary.manuscripts_compared.length} manuscripts
            </span>
            {isAuthenticated && (
              <button
                onClick={(e) => { e.preventDefault(); handleGenerate(true); }}
                disabled={generating}
                className="ml-auto text-xs text-purple-500 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200 disabled:opacity-50"
                title="Regenerate cross-manuscript comparison"
              >
                {generating ? "Regenerating…" : "Regenerate"}
              </button>
            )}
          </summary>

          <div className="mt-3 space-y-3">
            <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{summary.comparative_overview}</p>

            {summary.areas_of_agreement && (
              <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Agreement:</span>{" "}
                {summary.areas_of_agreement}
              </p>
            )}

            {summary.notable_divergences && (
              <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Divergences:</span>{" "}
                {summary.notable_divergences}
              </p>
            )}

            {summary.textual_implications && (
              <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Implications:</span>{" "}
                {summary.textual_implications}
              </p>
            )}

            {Array.isArray(summary.manuscripts_compared) && summary.manuscripts_compared.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {summary.manuscripts_compared.map((ms) => (
                  <span
                    key={ms}
                    className="rounded-full bg-white dark:bg-gray-800 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-400 ring-1 ring-gray-200 dark:ring-gray-700"
                  >
                    {ms}
                  </span>
                ))}
              </div>
            )}
          </div>
        </details>
      ) : isAuthenticated ? (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleGenerate()}
            disabled={generating}
            className="flex items-center gap-1.5 text-sm font-medium text-purple-700 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-200 disabled:opacity-50"
          >
            {generating ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating comparison…
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
                Compare {manuscriptCount} manuscripts for this chapter
              </>
            )}
          </button>
          {error && <ApiKeyError message={error} />}
        </div>
      ) : null}
    </div>
  );
}
