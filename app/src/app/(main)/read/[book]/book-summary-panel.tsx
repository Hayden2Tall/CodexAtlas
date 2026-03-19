"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

const COST_PER_BOOK = 0.015;
const COST_PER_CHAPTER = 0.002;
const DELAY_BETWEEN_MS = 1000;

interface BookSummaryContent {
  overview: string;
  structure: string;
  theological_themes: string[];
  manuscript_tradition: string;
  scholarly_significance: string;
}

interface Props {
  book: string;
  chapters: number[];
  summarizedChapters: Set<number>;
  cachedSummary: BookSummaryContent | null;
  generatedAt: string | null;
  model: string | null;
  isAuthenticated: boolean;
}

export function BookSummaryPanel({
  book,
  chapters,
  summarizedChapters,
  cachedSummary,
  generatedAt,
  model,
  isAuthenticated,
}: Props) {
  const router = useRouter();
  const [summary, setSummary] = useState<BookSummaryContent | null>(cachedSummary);
  const [summaryAt, setSummaryAt] = useState(generatedAt);
  const [summaryModel, setSummaryModel] = useState(model);
  const [expanded, setExpanded] = useState(!!cachedSummary);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Bulk chapter summary state
  const unsummarizedChapters = chapters.filter((ch) => !summarizedChapters.has(ch));
  const [chapterPhase, setChapterPhase] = useState<"idle" | "confirming" | "running" | "done">("idle");
  const [chapterProgress, setChapterProgress] = useState({ done: 0, failed: 0, total: 0, current: 0 });
  const [pendingChapters, setPendingChapters] = useState<number[]>([]);
  const [pendingForce, setPendingForce] = useState(false);

  const handleGenerateBook = useCallback(async (force = false) => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/summaries/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ book, ...(force && { force: true }) }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Generation failed");
      }
      setSummary(data.summary as BookSummaryContent);
      setSummaryAt(new Date().toISOString());
      setSummaryModel(data.usage?.ai_model ?? null);
      setExpanded(true);
      router.refresh();
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [book, router]);

  async function startChapterSummaries() {
    const chaptersToRun = pendingChapters;
    const force = pendingForce;
    setChapterPhase("running");
    setChapterProgress({ done: 0, failed: 0, total: chaptersToRun.length, current: 0 });

    let done = 0, failed = 0;

    for (let i = 0; i < chaptersToRun.length; i++) {
      const ch = chaptersToRun[i];
      setChapterProgress({ done, failed, total: chaptersToRun.length, current: ch });

      try {
        const res = await fetch("/api/summaries/chapter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ book, chapter: ch, ...(force && { force: true }) }),
        });
        if (res.ok) done++;
        else failed++;
      } catch {
        failed++;
      }

      if (i < chaptersToRun.length - 1) {
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_MS));
      }
    }

    setChapterProgress({ done, failed, total: chaptersToRun.length, current: 0 });
    setChapterPhase("done");
    router.refresh();
  }

  function queueChapters(chaptersToRun: number[], force: boolean) {
    setPendingChapters(chaptersToRun);
    setPendingForce(force);
    setChapterPhase("confirming");
  }

  const chapterCostEst = unsummarizedChapters.length * COST_PER_CHAPTER;

  return (
    <div className="space-y-4">
      {/* Book Summary */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-blue-800">Book Summary</h2>
            {summaryModel && (
              <span className="rounded-full bg-blue-100 px-1.5 py-0 text-[9px] font-semibold uppercase text-blue-600 ring-1 ring-inset ring-blue-200">
                AI · {summaryModel}
              </span>
            )}
            {summaryAt && (
              <span className="text-xs text-gray-400">
                {new Date(summaryAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {isAuthenticated && (
            <button
              onClick={() => handleGenerateBook(!!summary)}
              disabled={generating}
              className="flex items-center gap-1 rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating…
                </>
              ) : summary ? (
                "Regenerate"
              ) : (
                <>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                  </svg>
                  Generate — ~${COST_PER_BOOK.toFixed(2)}
                </>
              )}
            </button>
          )}
        </div>

        {generateError && (
          <p className="mb-3 text-xs text-red-600">{generateError}</p>
        )}

        {summary ? (
          <details open={expanded} onToggle={(e) => setExpanded((e.target as HTMLDetailsElement).open)}>
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-blue-800 hover:text-blue-900">
              <svg
                className={`h-3.5 w-3.5 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
                fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              {expanded ? "Hide" : "Show"} book overview
            </summary>
            <div className="mt-3 space-y-3">
              <p className="text-sm leading-relaxed text-gray-700">{summary.overview}</p>
              {summary.structure && (
                <p className="text-xs leading-relaxed text-gray-600">
                  <span className="font-semibold text-gray-700">Structure:</span> {summary.structure}
                </p>
              )}
              {summary.manuscript_tradition && (
                <p className="text-xs leading-relaxed text-gray-600">
                  <span className="font-semibold text-gray-700">Manuscript tradition:</span> {summary.manuscript_tradition}
                </p>
              )}
              {summary.scholarly_significance && (
                <p className="text-xs leading-relaxed text-gray-600">
                  <span className="font-semibold text-gray-700">Significance:</span> {summary.scholarly_significance}
                </p>
              )}
              {summary.theological_themes?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {summary.theological_themes.map((theme) => (
                    <span key={theme} className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-gray-600 ring-1 ring-gray-200">
                      {theme}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </details>
        ) : (
          <p className="text-sm text-gray-500">
            {isAuthenticated
              ? "No book summary yet. Generate one above — requires chapter summaries to exist first."
              : "No book summary yet."}
          </p>
        )}
      </div>

      {/* Chapter Summaries Bulk Generate */}
      {isAuthenticated && unsummarizedChapters.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Chapter summaries</p>
              <p className="text-xs text-gray-500">
                {summarizedChapters.size}/{chapters.length} chapters have summaries
                {unsummarizedChapters.length > 0 && ` · ${unsummarizedChapters.length} remaining`}
              </p>
            </div>

            {chapterPhase === "idle" && (
              <button
                onClick={() => queueChapters(unsummarizedChapters, false)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                </svg>
                Generate {unsummarizedChapters.length} chapter summaries — ~${chapterCostEst.toFixed(2)}
              </button>
            )}

            {chapterPhase === "confirming" && (
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs font-medium text-gray-800">
                  {pendingForce
                    ? `Re-run summaries for all ${pendingChapters.length} chapter${pendingChapters.length !== 1 ? "s" : ""}?`
                    : `Generate summaries for ${pendingChapters.length} chapter${pendingChapters.length !== 1 ? "s" : ""}?`}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  ~${(pendingChapters.length * COST_PER_CHAPTER).toFixed(2)} estimated cost (Haiku). Each chapter calls the AI API.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={startChapterSummaries}
                    className="rounded-md bg-gray-800 px-3 py-1 text-xs font-medium text-white hover:bg-gray-900"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setChapterPhase("idle")}
                    className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {chapterPhase === "running" && (
              <div className="min-w-[200px] space-y-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-primary-600 transition-all"
                    style={{ width: `${Math.round(((chapterProgress.done + chapterProgress.failed) / chapterProgress.total) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  {chapterProgress.done + chapterProgress.failed}/{chapterProgress.total}
                  {chapterProgress.failed > 0 && <span className="ml-1 text-red-500">{chapterProgress.failed} failed</span>}
                  {chapterProgress.current > 0 && <span className="ml-1 text-gray-400">— Ch. {chapterProgress.current}</span>}
                </p>
              </div>
            )}

            {chapterPhase === "done" && (
              <p className="text-xs text-green-700">
                {chapterProgress.done} chapter{chapterProgress.done !== 1 ? "s" : ""} summarized
                {chapterProgress.failed > 0 && <span className="text-red-500"> · {chapterProgress.failed} failed</span>}
              </p>
            )}
          </div>
        </div>
      )}

      {isAuthenticated && unsummarizedChapters.length === 0 && chapters.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Chapter summaries</p>
              <p className="text-xs text-gray-500">
                All {chapters.length} chapter{chapters.length !== 1 ? "s" : ""} have summaries
              </p>
            </div>

            {chapterPhase === "idle" && (
              <button
                onClick={() => queueChapters(chapters, true)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Re-run all — ~${(chapters.length * COST_PER_CHAPTER).toFixed(2)}
              </button>
            )}

            {chapterPhase === "confirming" && (
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs font-medium text-gray-800">
                  Re-run summaries for all {pendingChapters.length} chapters?
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  ~${(pendingChapters.length * COST_PER_CHAPTER).toFixed(2)} estimated cost. Overwrites existing summaries.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={startChapterSummaries}
                    className="rounded-md bg-gray-800 px-3 py-1 text-xs font-medium text-white hover:bg-gray-900"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setChapterPhase("idle")}
                    className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {chapterPhase === "running" && (
              <div className="min-w-[200px] space-y-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-primary-600 transition-all"
                    style={{ width: `${Math.round(((chapterProgress.done + chapterProgress.failed) / chapterProgress.total) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  {chapterProgress.done + chapterProgress.failed}/{chapterProgress.total}
                  {chapterProgress.failed > 0 && <span className="ml-1 text-red-500">{chapterProgress.failed} failed</span>}
                  {chapterProgress.current > 0 && <span className="ml-1 text-gray-400">— Ch. {chapterProgress.current}</span>}
                </p>
              </div>
            )}

            {chapterPhase === "done" && (
              <p className="text-xs text-green-700">
                {chapterProgress.done} chapter{chapterProgress.done !== 1 ? "s" : ""} re-run
                {chapterProgress.failed > 0 && <span className="text-red-500"> · {chapterProgress.failed} failed</span>}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
