"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { BulkTranslateTrigger } from "@/components/admin/bulk-translate-trigger";

interface Passage {
  id: string;
  reference: string;
}

interface Manuscript {
  id: string;
  title: string;
  has_summary: boolean;
}

interface Chapter {
  number: number;
  manuscript_count: number;
  has_summary: boolean;
  has_cross_manuscript: boolean;
}

interface BookData {
  passages: Passage[];
  manuscripts: Manuscript[];
  chapters: Chapter[];
  untranslated_passages: Passage[];
  unsummarized_passages: Passage[];
}

interface BatchState {
  phase: "idle" | "running" | "done";
  done: number;
  failed: number;
  total: number;
  current: string;
}

const IDLE: BatchState = { phase: "idle", done: 0, failed: 0, total: 0, current: "" };
const DELAY_MS = 1500;

function BatchProgress({
  state,
  onCancel,
}: {
  state: BatchState;
  onCancel: () => void;
}) {
  if (state.phase === "idle") return null;

  if (state.phase === "done") {
    return (
      <p className="text-xs text-green-700 dark:text-green-400">
        Done — {state.done} succeeded{state.failed > 0 ? `, ${state.failed} failed` : ""}.
      </p>
    );
  }

  const pct = state.total > 0 ? Math.round(((state.done + state.failed) / state.total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full rounded-full bg-primary-600 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>
          {state.done + state.failed} / {state.total}
          {state.failed > 0 && <span className="ml-1 text-red-500">· {state.failed} failed</span>}
          {state.current && <span className="ml-1 text-gray-400">— {state.current}</span>}
        </span>
        <button onClick={onCancel} className="text-xs text-red-500 hover:text-red-700">
          Cancel
        </button>
      </div>
    </div>
  );
}

async function runBatch(
  items: { label: string; doFetch: () => Promise<Response> }[],
  setState: React.Dispatch<React.SetStateAction<BatchState>>,
  cancelRef: React.MutableRefObject<boolean>,
  onDone: () => void
) {
  cancelRef.current = false;
  setState({ phase: "running", done: 0, failed: 0, total: items.length, current: "" });
  let done = 0;
  let failed = 0;

  for (const item of items) {
    if (cancelRef.current) break;
    setState((s) => ({ ...s, current: item.label }));
    try {
      const res = await item.doFetch();
      if (res.ok) done++;
      else failed++;
    } catch {
      failed++;
    }
    setState((s) => ({ ...s, done, failed }));
    if (!cancelRef.current) await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  setState((s) => ({ ...s, phase: "done", current: "" }));
  onDone();
}

export function BookAdminPanel({ book }: { book: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BookData | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [chapterState, setChapterState] = useState<BatchState>(IDLE);
  const [manuscriptState, setManuscriptState] = useState<BatchState>(IDLE);
  const [crossState, setCrossState] = useState<BatchState>(IDLE);
  const [passageSummaryState, setPassageSummaryState] = useState<BatchState>(IDLE);
  const [translateMode, setTranslateMode] = useState<"missing" | "all" | null>(null);

  const cancelChapter = useRef(false);
  const cancelManuscript = useRef(false);
  const cancelCross = useRef(false);
  const cancelPassageSummary = useRef(false);

  async function loadData() {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/admin/book-data?book=${encodeURIComponent(book)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Failed to load book data");
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    if (!open && !data) loadData();
    setOpen((prev) => !prev);
  }

  function startChapterSummaries(force: boolean) {
    if (!data || chapterState.phase === "running") return;
    const targets = force ? data.chapters : data.chapters.filter((c) => !c.has_summary);
    if (targets.length === 0) return;
    runBatch(
      targets.map((c) => ({
        label: `${book} ${c.number}`,
        doFetch: () =>
          fetch("/api/summaries/chapter", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ book, chapter: c.number, force }),
          }),
      })),
      setChapterState,
      cancelChapter,
      () => router.refresh()
    );
  }

  function startManuscriptSummaries(force: boolean) {
    if (!data || manuscriptState.phase === "running") return;
    const targets = force ? data.manuscripts : data.manuscripts.filter((m) => !m.has_summary);
    if (targets.length === 0) return;
    runBatch(
      targets.map((m) => ({
        label: m.title,
        doFetch: () =>
          fetch("/api/summaries/manuscript", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ manuscript_id: m.id, force }),
          }),
      })),
      setManuscriptState,
      cancelManuscript,
      () => router.refresh()
    );
  }

  function startPassageSummaries(force: boolean) {
    if (!data || passageSummaryState.phase === "running") return;
    const targets = force ? data.passages : data.unsummarized_passages;
    if (targets.length === 0) return;
    runBatch(
      targets.map((p) => ({
        label: p.reference,
        doFetch: () =>
          fetch("/api/summaries/passage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ passage_id: p.id, ...(force && { force: true }) }),
          }),
      })),
      setPassageSummaryState,
      cancelPassageSummary,
      () => router.refresh()
    );
  }

  function startCrossManuscript(force: boolean) {
    if (!data || crossState.phase === "running") return;
    const eligible = data.chapters.filter((c) => c.manuscript_count >= 2);
    const targets = force ? eligible : eligible.filter((c) => !c.has_cross_manuscript);
    if (targets.length === 0) return;
    runBatch(
      targets.map((c) => ({
        label: `${book} ${c.number}`,
        doFetch: () =>
          fetch("/api/summaries/cross-manuscript", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ book, chapter: c.number, force }),
          }),
      })),
      setCrossState,
      cancelCross,
      () => router.refresh()
    );
  }

  const unsummarizedChapters = data?.chapters.filter((c) => !c.has_summary).length ?? 0;
  const unsummarizedManuscripts = data?.manuscripts.filter((m) => !m.has_summary).length ?? 0;
  const eligibleCross = data?.chapters.filter((c) => c.manuscript_count >= 2) ?? [];
  const uncomparedCross = eligibleCross.filter((c) => !c.has_cross_manuscript).length;
  const untranslatedCount = data?.untranslated_passages.length ?? 0;
  const unsummarizedPassagesCount = data?.unsummarized_passages.length ?? 0;

  return (
    <section className="mb-6 rounded-xl border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10">
      <button
        onClick={toggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">Admin — Book Operations</span>
        <span className="text-xs text-amber-600 dark:text-amber-400">{open ? "▲ collapse" : "▼ expand"}</span>
      </button>

      {open && (
        <div className="border-t border-amber-200 dark:border-amber-800/50 px-4 py-4 space-y-6">
          {loading && <p className="text-xs text-gray-500 dark:text-gray-400">Loading book data…</p>}
          {fetchError && <p className="text-xs text-red-600">{fetchError}</p>}

          {data && (
            <>
              {/* Stats row */}
              <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span>{data.passages.length} passages ({untranslatedCount} untranslated)</span>
                <span>{data.manuscripts.length} manuscripts</span>
                <span>{data.chapters.length} chapters</span>
                <span>{eligibleCross.length} chapters eligible for cross-manuscript</span>
              </div>

              {/* 1. Translate passages */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Translate passages
                </h3>
                {translateMode === null ? (
                  <div className="flex gap-2 flex-wrap">
                    {untranslatedCount > 0 && (
                      <button
                        onClick={() => setTranslateMode("missing")}
                        className="rounded-md bg-primary-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-800"
                      >
                        Translate missing ({untranslatedCount})
                      </button>
                    )}
                    <button
                      onClick={() => setTranslateMode("all")}
                      className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      Retranslate all ({data.passages.length})
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {translateMode === "missing"
                          ? `Translating ${untranslatedCount} missing passages`
                          : `Retranslating all ${data.passages.length} passages`}
                      </span>
                      <button
                        onClick={() => setTranslateMode(null)}
                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        ✕ back
                      </button>
                    </div>
                    <BulkTranslateTrigger
                      key={translateMode}
                      passages={translateMode === "missing" ? data.untranslated_passages : data.passages}
                      label={translateMode === "missing" ? `(missing) in ${book}` : `across all chapters of ${book}`}
                      size="sm"
                    />
                  </div>
                )}
              </div>

              {/* 2. Passage summaries */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Passage summaries
                </h3>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {unsummarizedPassagesCount} of {data.passages.length} passages need summaries.
                </p>
                <BatchProgress
                  state={passageSummaryState}
                  onCancel={() => { cancelPassageSummary.current = true; }}
                />
                {passageSummaryState.phase !== "running" && (
                  <div className="flex gap-2">
                    {unsummarizedPassagesCount > 0 && (
                      <button
                        onClick={() => startPassageSummaries(false)}
                        className="rounded-md bg-primary-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-800"
                      >
                        Generate missing ({unsummarizedPassagesCount})
                      </button>
                    )}
                    <button
                      onClick={() => startPassageSummaries(true)}
                      className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      Regenerate all ({data.passages.length})
                    </button>
                  </div>
                )}
              </div>

              {/* 3. Chapter summaries */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Chapter summaries
                </h3>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {unsummarizedChapters} of {data.chapters.length} chapters need summaries.
                </p>
                <BatchProgress
                  state={chapterState}
                  onCancel={() => { cancelChapter.current = true; }}
                />
                {chapterState.phase !== "running" && (
                  <div className="flex gap-2">
                    {unsummarizedChapters > 0 && (
                      <button
                        onClick={() => startChapterSummaries(false)}
                        className="rounded-md bg-primary-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-800"
                      >
                        Generate missing ({unsummarizedChapters})
                      </button>
                    )}
                    <button
                      onClick={() => startChapterSummaries(true)}
                      className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      Regenerate all ({data.chapters.length})
                    </button>
                  </div>
                )}
              </div>

              {/* 4. Manuscript summaries */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Manuscript summaries
                </h3>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {unsummarizedManuscripts} of {data.manuscripts.length} manuscripts need summaries.
                </p>
                <BatchProgress
                  state={manuscriptState}
                  onCancel={() => { cancelManuscript.current = true; }}
                />
                {manuscriptState.phase !== "running" && (
                  <div className="flex gap-2">
                    {unsummarizedManuscripts > 0 && (
                      <button
                        onClick={() => startManuscriptSummaries(false)}
                        className="rounded-md bg-primary-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-800"
                      >
                        Generate missing ({unsummarizedManuscripts})
                      </button>
                    )}
                    <button
                      onClick={() => startManuscriptSummaries(true)}
                      className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      Regenerate all ({data.manuscripts.length})
                    </button>
                  </div>
                )}
              </div>

              {/* 5. Cross-manuscript comparisons */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Cross-manuscript comparisons
                </h3>
                {eligibleCross.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    No chapters have 2+ manuscripts — cross-manuscript comparison not available.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {uncomparedCross} of {eligibleCross.length} eligible chapters need comparisons.
                    </p>
                    <BatchProgress
                      state={crossState}
                      onCancel={() => { cancelCross.current = true; }}
                    />
                    {crossState.phase !== "running" && (
                      <div className="flex gap-2">
                        {uncomparedCross > 0 && (
                          <button
                            onClick={() => startCrossManuscript(false)}
                            className="rounded-md bg-primary-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-800"
                          >
                            Generate missing ({uncomparedCross})
                          </button>
                        )}
                        <button
                          onClick={() => startCrossManuscript(true)}
                          className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          Regenerate all ({eligibleCross.length})
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
