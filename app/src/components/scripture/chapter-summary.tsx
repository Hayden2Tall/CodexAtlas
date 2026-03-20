"use client";

import { useState, useCallback } from "react";

interface ChapterSummaryContent {
  overview: string;
  theological_themes: string[];
  manuscript_notes: string;
  scholarly_significance: string;
}

interface ChapterSummaryProps {
  book: string;
  chapter: number;
  cachedSummary: ChapterSummaryContent | null;
  isAuthenticated: boolean;
}

export function ChapterSummary({
  book,
  chapter,
  cachedSummary,
  isAuthenticated,
}: ChapterSummaryProps) {
  const [summary, setSummary] = useState<ChapterSummaryContent | null>(cachedSummary);
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async (force = false) => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/summaries/chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ book, chapter, ...(force && { force: true }) }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to generate summary");
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

  if (!summary && !isAuthenticated) return null;

  return (
    <div className="mb-8 rounded-xl border border-blue-100 dark:border-blue-800/50 bg-blue-50/40 dark:bg-blue-900/10 px-5 py-4">
      {summary ? (
        <details
          className="group"
          open={expanded}
          onToggle={(e) => setExpanded((e.target as HTMLDetailsElement).open)}
        >
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-blue-800 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-200">
            <svg
              className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Chapter overview
            <span className="ml-1 rounded-full bg-blue-100 dark:bg-blue-900/50 px-1.5 py-0 text-[9px] font-semibold uppercase text-blue-600 dark:text-blue-400 ring-1 ring-inset ring-blue-300 dark:ring-blue-700">
              AI Summary
            </span>
            {isAuthenticated && (
              <button
                onClick={(e) => { e.preventDefault(); handleGenerate(true); }}
                disabled={generating}
                className="ml-auto text-xs text-blue-500 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 disabled:opacity-50"
                title="Regenerate chapter overview"
              >
                {generating ? "Regenerating…" : "Regenerate"}
              </button>
            )}
          </summary>

          <div className="mt-3 space-y-3">
            <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{summary.overview}</p>

            {summary.manuscript_notes && (
              <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Manuscript notes:</span>{" "}
                {summary.manuscript_notes}
              </p>
            )}

            {summary.scholarly_significance && (
              <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Significance:</span>{" "}
                {summary.scholarly_significance}
              </p>
            )}

            {Array.isArray(summary.theological_themes) && summary.theological_themes.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {summary.theological_themes.map((theme) => (
                  <span
                    key={theme}
                    className="rounded-full bg-white dark:bg-gray-800 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-400 ring-1 ring-gray-200 dark:ring-gray-700"
                  >
                    {theme}
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
            className="flex items-center gap-1.5 text-sm font-medium text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-200 disabled:opacity-50"
          >
            {generating ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating chapter overview…
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                </svg>
                Generate chapter overview
              </>
            )}
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      ) : null}
    </div>
  );
}
