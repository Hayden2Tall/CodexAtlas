"use client";

import { useState, useCallback } from "react";

interface ManuscriptSummaryData {
  summary: string;
  significance_factors: string[];
  historical_period: string;
  related_traditions: string;
}

interface ManuscriptSummaryProps {
  manuscriptId: string;
  cachedSummary: ManuscriptSummaryData | null;
  isAuthenticated: boolean;
}

export function ManuscriptSummary({ manuscriptId, cachedSummary, isAuthenticated }: ManuscriptSummaryProps) {
  const [summary, setSummary] = useState<ManuscriptSummaryData | null>(cachedSummary);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async (force = false) => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/summaries/manuscript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manuscript_id: manuscriptId, ...(force && { force: true }) }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate summary");
      }
      const data = await res.json();
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate summary");
    } finally {
      setGenerating(false);
    }
  }, [manuscriptId]);

  if (!summary && !isAuthenticated) return null;

  return (
    <section className="rounded-lg border border-primary-100 bg-primary-50/20 p-5">
      <div className="mb-3 flex items-center gap-2">
        <svg className="h-4 w-4 text-primary-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
        </svg>
        <h2 className="font-serif text-lg font-semibold text-gray-900">
          Scholarly Significance
        </h2>
        <span className="rounded-full bg-blue-50 px-1.5 py-0 text-[9px] font-semibold uppercase text-blue-600 ring-1 ring-inset ring-blue-200">
          AI Summary
        </span>
        {summary && isAuthenticated && (
          <button
            onClick={() => handleGenerate(true)}
            disabled={generating}
            className="ml-auto text-xs text-gray-400 hover:text-primary-600 disabled:opacity-50"
            title="Regenerate significance summary"
          >
            {generating ? "Regenerating…" : "Regenerate"}
          </button>
        )}
      </div>

      {summary ? (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-gray-700">{summary.summary}</p>

          {Array.isArray(summary.significance_factors) && summary.significance_factors.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Key Factors
              </h3>
              <ul className="space-y-1">
                {summary.significance_factors.map((factor, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400" />
                    {factor}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.historical_period && (
            <p className="text-xs text-gray-600">
              <span className="font-semibold">Period:</span> {summary.historical_period}
            </p>
          )}

          {summary.related_traditions && (
            <p className="text-xs text-gray-600">
              <span className="font-semibold">Traditions:</span> {summary.related_traditions}
            </p>
          )}
        </div>
      ) : isAuthenticated ? (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleGenerate()}
            disabled={generating}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-white px-3 py-1.5 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-50 disabled:opacity-50"
          >
            {generating ? (
              <>
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating…
              </>
            ) : (
              "Generate Significance Summary"
            )}
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      ) : null}
    </section>
  );
}
