"use client";

import { useState, useCallback } from "react";

interface PassageSummaryData {
  summary: string;
  historical_context: string;
  significance: string;
  key_themes: string[];
}

interface PassageSummaryProps {
  passageId: string;
  cachedSummary: PassageSummaryData | null;
  isAuthenticated: boolean;
}

export function PassageSummary({ passageId, cachedSummary, isAuthenticated }: PassageSummaryProps) {
  const [summary, setSummary] = useState<PassageSummaryData | null>(cachedSummary);
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async (force = false) => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/summaries/passage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passage_id: passageId, ...(force && { force: true }) }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate summary");
      }
      const data = await res.json();
      setSummary(data.summary);
      setExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate summary");
    } finally {
      setGenerating(false);
    }
  }, [passageId]);

  if (!summary && !isAuthenticated) return null;

  return (
    <div className="mt-3 border-t border-gray-100 dark:border-gray-800 pt-3">
      {summary ? (
        <details
          className="group"
          open={expanded}
          onToggle={(e) => setExpanded((e.target as HTMLDetailsElement).open)}
        >
          <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-primary-700 dark:hover:text-primary-400">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
            About this passage
            <span className="ml-1 rounded-full bg-blue-50 dark:bg-blue-900/50 px-1.5 py-0 text-[9px] font-semibold uppercase text-blue-600 dark:text-blue-400 ring-1 ring-inset ring-blue-200 dark:ring-blue-700">
              AI Summary
            </span>
            {isAuthenticated && (
              <button
                onClick={(e) => { e.preventDefault(); handleGenerate(true); }}
                disabled={generating}
                className="ml-auto text-[10px] text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 disabled:opacity-50"
                title="Regenerate summary"
              >
                {generating ? "Regenerating…" : "Regenerate"}
              </button>
            )}
          </summary>
          <div className="mt-2 space-y-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
            <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{summary.summary}</p>
            {summary.historical_context && (
              <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                <span className="font-semibold">Context:</span> {summary.historical_context}
              </p>
            )}
            {summary.significance && (
              <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                <span className="font-semibold">Significance:</span> {summary.significance}
              </p>
            )}
            {Array.isArray(summary.key_themes) && summary.key_themes.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {summary.key_themes.map((theme) => (
                  <span key={theme} className="rounded-full bg-white dark:bg-gray-800 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-400 ring-1 ring-gray-200 dark:ring-gray-700">
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
            className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-800 disabled:opacity-50"
          >
            {generating ? (
              <>
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating summary…
              </>
            ) : (
              <>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                </svg>
                Generate AI summary
              </>
            )}
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      ) : null}
    </div>
  );
}
