"use client";

import { useState, useCallback, useRef } from "react";

interface TocSection {
  reference: string;
  description: string;
  estimated_verses: number;
  already_imported: boolean;
  sequence_order?: number;
}

interface SectionResult {
  reference: string;
  status: "pending" | "importing" | "done" | "skipped" | "failed";
  textLength?: number;
  cost?: number;
  error?: string;
  reason?: string;
}

type ImportPhase = "idle" | "loading-toc" | "selecting" | "importing" | "complete";

interface Props {
  manuscripts: { id: string; title: string; original_language: string }[];
}

export function FullImportPanel({ manuscripts }: Props) {
  const [selectedMs, setSelectedMs] = useState("");
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [sections, setSections] = useState<TocSection[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Map<string, SectionResult>>(new Map());
  const [tocCost, setTocCost] = useState(0);
  const [estimatedImportCost, setEstimatedImportCost] = useState(0);
  const [totalImportCost, setTotalImportCost] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const cancelRef = useRef(false);

  const ms = manuscripts.find((m) => m.id === selectedMs);

  const loadToc = useCallback(async () => {
    if (!ms) return;
    setPhase("loading-toc");
    setSections([]);
    setSelected(new Set());
    setResults(new Map());
    setErrorMessage("");
    setTocCost(0);
    setEstimatedImportCost(0);
    setTotalImportCost(0);

    try {
      const res = await fetch("/api/agent/discover/toc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: ms.title,
          original_language: ms.original_language,
          manuscript_id: ms.id,
        }),
      });

      if (!res.ok) {
        let msg = `Server error (${res.status})`;
        try {
          const data = await res.json();
          msg = data.error ?? msg;
        } catch {
          if (res.status === 504) msg = "Request timed out. Try a smaller manuscript or try again.";
        }
        setErrorMessage(msg);
        setPhase("idle");
        return;
      }

      const data = await res.json();

      setSections(data.sections ?? []);
      setTocCost(data.usage?.estimated_cost_usd ?? 0);
      setEstimatedImportCost(data.estimated_import_cost ?? 0);

      const newSections = (data.sections ?? []).filter(
        (s: TocSection) => !s.already_imported
      );
      setSelected(new Set(newSections.map((s: TocSection) => s.reference)));
      setPhase("selecting");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Network error");
      setPhase("idle");
    }
  }, [ms]);

  const toggleSection = (ref: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  };

  const selectAll = () => {
    const importable = sections.filter((s) => !s.already_imported);
    setSelected(new Set(importable.map((s) => s.reference)));
  };

  const selectNone = () => setSelected(new Set());

  const startImport = useCallback(async () => {
    if (!ms || selected.size === 0) return;
    cancelRef.current = false;
    setPhase("importing");
    setTotalImportCost(0);

    const toImport = sections
      .filter((s) => selected.has(s.reference) && !s.already_imported)
      .map((s, i) => ({ ...s, sequence_order: i + 1 }));

    const initResults = new Map<string, SectionResult>();
    for (const s of toImport) {
      initResults.set(s.reference, { reference: s.reference, status: "pending" });
    }
    setResults(initResults);

    let runningCost = 0;

    for (let i = 0; i < toImport.length; i++) {
      if (cancelRef.current) break;

      const section = toImport[i];
      setResults((prev) => {
        const next = new Map(prev);
        next.set(section.reference, {
          reference: section.reference,
          status: "importing",
        });
        return next;
      });

      const MAX_RETRIES = 2;
      let lastReason = "";

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (cancelRef.current) break;

        try {
          const res = await fetch("/api/agent/discover/section-text", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              manuscript_id: ms.id,
              manuscript_title: ms.title,
              original_language: ms.original_language,
              reference: section.reference,
              description: section.description,
              sequence_order: section.sequence_order,
            }),
          });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let data: any;
          try {
            data = await res.json();
          } catch {
            throw new Error(res.status === 504 ? "Timed out" : `Server error (${res.status})`);
          }

          if (data.skipped) {
            const reason: string = data.reason ?? "Already exists";
            const isRetryable = reason.startsWith("AI refused") || reason.startsWith("Wrong script");

            if (isRetryable && attempt < MAX_RETRIES) {
              lastReason = reason;
              setResults((prev) => {
                const next = new Map(prev);
                next.set(section.reference, {
                  reference: section.reference,
                  status: "importing",
                  reason: `Retry ${attempt + 1}/${MAX_RETRIES} — ${reason}`,
                });
                return next;
              });
              await new Promise((r) => setTimeout(r, 2000));
              continue;
            }

            setResults((prev) => {
              const next = new Map(prev);
              next.set(section.reference, {
                reference: section.reference,
                status: "skipped",
                reason: attempt > 0 ? `${reason} (after ${attempt + 1} attempts)` : reason,
              });
              return next;
            });
          } else if (res.ok) {
            const cost = data.usage?.estimated_cost_usd ?? 0;
            runningCost += cost;
            setTotalImportCost(runningCost);
            setResults((prev) => {
              const next = new Map(prev);
              next.set(section.reference, {
                reference: section.reference,
                status: "done",
                textLength: data.text_length,
                cost,
              });
              return next;
            });
          } else {
            const errMsg = data.error ?? "Unknown error";
            if (attempt < MAX_RETRIES) {
              lastReason = errMsg;
              await new Promise((r) => setTimeout(r, 2000));
              continue;
            }
            setResults((prev) => {
              const next = new Map(prev);
              next.set(section.reference, {
                reference: section.reference,
                status: "failed",
                error: `${errMsg} (after ${attempt + 1} attempts)`,
              });
              return next;
            });
          }
          break;
        } catch (err) {
          if (attempt < MAX_RETRIES) {
            lastReason = err instanceof Error ? err.message : "Network error";
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          setResults((prev) => {
            const next = new Map(prev);
            next.set(section.reference, {
              reference: section.reference,
              status: "failed",
              error: `${lastReason || (err instanceof Error ? err.message : "Network error")} (after ${attempt + 1} attempts)`,
            });
            return next;
          });
          break;
        }
      }

      // Rate limit: 1.5s between calls
      if (i < toImport.length - 1 && !cancelRef.current) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    setPhase("complete");
  }, [ms, selected, sections]);

  const completedCount = Array.from(results.values()).filter(
    (r) => r.status === "done"
  ).length;
  const failedCount = Array.from(results.values()).filter(
    (r) => r.status === "failed"
  ).length;
  const skippedCount = Array.from(results.values()).filter(
    (r) => r.status === "skipped"
  ).length;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-700">
        Full Manuscript Import
      </h2>
      <p className="mt-1 text-xs text-gray-500">
        Scan a manuscript&apos;s complete table of contents, select sections, and
        import full original-language text for each one.
      </p>

      {/* Manuscript selector */}
      <div className="mt-4 flex gap-3">
        <select
          value={selectedMs}
          onChange={(e) => {
            setSelectedMs(e.target.value);
            setPhase("idle");
            setSections([]);
          }}
          disabled={phase === "importing" || phase === "loading-toc"}
          className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          <option value="">Select a manuscript...</option>
          {manuscripts.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
        <button
          onClick={loadToc}
          disabled={
            !selectedMs ||
            phase === "loading-toc" ||
            phase === "importing"
          }
          className="rounded-md bg-primary-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-800 transition-colors disabled:opacity-50"
        >
          {phase === "loading-toc" ? "Scanning..." : "Scan TOC"}
        </button>
      </div>

      {errorMessage && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {phase === "loading-toc" && (
        <div className="mt-6 flex items-center justify-center gap-2 py-8">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-300 border-t-primary-700" />
          <span className="text-sm text-gray-500">
            Loading table of contents...
          </span>
        </div>
      )}

      {/* TOC selection phase */}
      {(phase === "selecting" || phase === "importing" || phase === "complete") &&
        sections.length > 0 && (
          <div className="mt-4 space-y-3">
            {/* Summary bar */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                <span className="font-medium">{sections.length}</span> sections
                found
                {sections.some((s) => s.already_imported) && (
                  <span className="ml-1 text-xs text-gray-400">
                    ({sections.filter((s) => s.already_imported).length} already
                    imported)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>TOC cost: ${tocCost.toFixed(4)}</span>
                {estimatedImportCost > 0 && phase === "selecting" && (
                  <span>
                    Est. import: ~${(estimatedImportCost * (selected.size / Math.max(sections.filter((s) => !s.already_imported).length, 1))).toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            {/* Select all / none */}
            {phase === "selecting" && (
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-50"
                >
                  Select all new
                </button>
                <button
                  onClick={selectNone}
                  className="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-50"
                >
                  Select none
                </button>
                <span className="ml-auto text-xs text-gray-400">
                  {selected.size} selected
                </span>
              </div>
            )}

            {/* Section list */}
            <div className="max-h-80 overflow-y-auto rounded-md border border-gray-100">
              {sections.map((s) => {
                const result = results.get(s.reference);
                const isChecked = selected.has(s.reference);
                return (
                  <label
                    key={s.reference}
                    className={`flex items-center gap-3 border-b border-gray-50 px-3 py-2 text-sm ${
                      s.already_imported
                        ? "bg-gray-50 text-gray-400"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSection(s.reference)}
                      disabled={
                        s.already_imported ||
                        phase === "importing" ||
                        phase === "complete"
                      }
                      className="rounded border-gray-300 text-primary-700 focus:ring-primary-500"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-800">
                        {s.reference}
                      </span>
                      {s.description && (
                        <span className="ml-2 text-xs text-gray-500 truncate">
                          — {s.description}
                        </span>
                      )}
                    </div>
                    <div className="shrink-0">
                      {s.already_imported ? (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">
                          Imported
                        </span>
                      ) : result?.status === "done" ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                          {result.textLength?.toLocaleString()} chars
                        </span>
                      ) : result?.status === "importing" ? (
                        <span className="flex items-center gap-1 text-xs text-primary-600">
                          <span className="h-3 w-3 animate-spin rounded-full border border-primary-300 border-t-primary-700" />
                          Importing
                        </span>
                      ) : result?.status === "skipped" ? (
                        <span
                          className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-600 cursor-help max-w-[220px] truncate"
                          title={result.reason ?? "Skipped"}
                        >
                          {result.reason ?? "Skipped"}
                        </span>
                      ) : result?.status === "failed" ? (
                        <span
                          className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600 cursor-help max-w-[200px] truncate"
                          title={result.error}
                        >
                          {result.error ?? "Failed"}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">
                          ~{s.estimated_verses} verses
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Import progress */}
            {(phase === "importing" || phase === "complete") && (
              <div className="space-y-2">
                <div className="h-2 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-primary-600 transition-all duration-300"
                    style={{
                      width: `${
                        (
                          (completedCount + failedCount + skippedCount) /
                          Math.max(results.size, 1)
                        ) * 100
                      }%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>
                    {completedCount} done, {skippedCount} skipped
                    {failedCount > 0 && `, ${failedCount} failed`}
                    {" / "}
                    {results.size} total
                  </span>
                  <span>Cost: ${totalImportCost.toFixed(4)}</span>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              {phase === "selecting" && (
                <button
                  onClick={startImport}
                  disabled={selected.size === 0}
                  className="rounded-md bg-primary-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-800 transition-colors disabled:opacity-50"
                >
                  Import {selected.size} Section{selected.size !== 1 ? "s" : ""}
                </button>
              )}
              {phase === "importing" && (
                <button
                  onClick={() => {
                    cancelRef.current = true;
                  }}
                  className="rounded-md border border-red-300 px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  Cancel
                </button>
              )}
              {phase === "complete" && failedCount > 0 && (
                <button
                  onClick={() => {
                    const failedRefs = new Set(
                      Array.from(results.entries())
                        .filter(([, r]) => r.status === "failed")
                        .map(([ref]) => ref)
                    );
                    setSelected(failedRefs);
                    setPhase("selecting");
                    setResults((prev) => {
                      const next = new Map(prev);
                      for (const ref of failedRefs) next.delete(ref);
                      return next;
                    });
                  }}
                  className="rounded-md bg-amber-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
                >
                  Retry {failedCount} Failed
                </button>
              )}
              {phase === "complete" && ms && (
                <a
                  href={`/manuscripts/${ms.id}`}
                  className="rounded-md bg-primary-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-800 transition-colors"
                >
                  View Manuscript
                </a>
              )}
              {phase === "complete" && (
                <button
                  onClick={() => {
                    setPhase("idle");
                    setSections([]);
                    setResults(new Map());
                  }}
                  className="rounded-md border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Start Over
                </button>
              )}
            </div>
          </div>
        )}
    </div>
  );
}
