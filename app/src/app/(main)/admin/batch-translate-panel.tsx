"use client";

import { useState, useRef, useCallback } from "react";
import type { AgentTask, Passage } from "@/lib/types";

interface Props {
  manuscripts: { id: string; title: string }[];
  onTaskCreated: (task: AgentTask) => void;
  onTaskUpdated: (task: AgentTask) => void;
}

type PendingPassage = Pick<Passage, "id" | "manuscript_id" | "reference" | "original_text"> & {
  is_translated?: boolean;
};

interface TranslationResult {
  passageId: string;
  reference: string;
  success: boolean;
  error?: string;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
}

type Phase = "idle" | "scanning" | "selecting" | "running" | "done";

const DELAY_BETWEEN_CALLS_MS = 1500;

export function BatchTranslatePanel({ manuscripts, onTaskCreated, onTaskUpdated }: Props) {
  const [selectedMs, setSelectedMs] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("English");
  const [phase, setPhase] = useState<Phase>("idle");
  const [allPassages, setAllPassages] = useState<PendingPassage[]>([]);
  const [selectedPassageIds, setSelectedPassageIds] = useState<Set<string>>(new Set());
  const [taskId, setTaskId] = useState<string | null>(null);
  const [results, setResults] = useState<Map<string, TranslationResult>>(new Map());
  const [statusMessage, setStatusMessage] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [scanStats, setScanStats] = useState<{ total: number; translated: number } | null>(null);

  const pauseRef = useRef(false);
  const cancelRef = useRef(false);

  const totalCost = Array.from(results.values()).reduce((s, r) => s + (r.costUsd ?? 0), 0);
  const successCount = Array.from(results.values()).filter((r) => r.success).length;
  const failCount = Array.from(results.values()).filter((r) => !r.success).length;

  const updateTaskProgress = useCallback(
    async (
      id: string,
      completed: number,
      failed: number,
      tIn: number,
      tOut: number,
      cost: number,
      status?: string
    ) => {
      const body: Record<string, unknown> = {
        completed_items: completed,
        failed_items: failed,
        tokens_input: tIn,
        tokens_output: tOut,
        estimated_cost_usd: cost,
      };
      if (status) {
        body.status = status;
        if (["completed", "failed", "cancelled"].includes(status)) {
          body.completed_at = new Date().toISOString();
        }
      }
      const res = await fetch(`/api/agent/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const { task } = await res.json();
        onTaskUpdated(task);
        return task;
      }
    },
    [onTaskUpdated]
  );

  async function handleScan() {
    setPhase("scanning");
    setResults(new Map());
    setAllPassages([]);
    setSelectedPassageIds(new Set());
    setScanStats(null);
    setStatusMessage("Scanning passages...");

    try {
      const res = await fetch("/api/agent/batch-translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_language: targetLanguage,
          manuscript_id: selectedMs || undefined,
          include_translated: true, // Always fetch all so we can show status
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatusMessage(`Error: ${data.error}`);
        setPhase("idle");
        return;
      }

      if (!data.task && (!data.pending_passages || data.pending_passages.length === 0)) {
        setStatusMessage(data.message ?? "No passages with original text found.");
        setPhase("idle");
        return;
      }

      setTaskId(data.task?.id ?? null);
      if (data.task) onTaskCreated(data.task);

      const passages: PendingPassage[] = data.pending_passages ?? [];
      setAllPassages(passages);
      setScanStats({ total: data.total_passages ?? passages.length, translated: data.already_translated ?? 0 });

      // Default selection: untranslated only
      const untranslated = passages.filter((p) => !p.is_translated);
      setSelectedPassageIds(new Set(untranslated.map((p) => p.id)));

      setStatusMessage("");
      setPhase("selecting");
    } catch (err) {
      setStatusMessage(`Error: ${err instanceof Error ? err.message : "Network error"}`);
      setPhase("idle");
    }
  }

  const togglePassage = (id: string) => {
    setSelectedPassageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllUntranslated = () => {
    setSelectedPassageIds(new Set(allPassages.filter((p) => !p.is_translated).map((p) => p.id)));
  };

  const selectAll = () => {
    setSelectedPassageIds(new Set(allPassages.map((p) => p.id)));
  };

  const selectNone = () => setSelectedPassageIds(new Set());

  async function handleStart() {
    const toTranslate = allPassages.filter((p) => selectedPassageIds.has(p.id));
    if (toTranslate.length === 0) return;

    cancelRef.current = false;
    pauseRef.current = false;
    setPhase("running");

    // Initialize result map
    const initResults = new Map<string, TranslationResult>();
    for (const p of toTranslate) {
      initResults.set(p.id, { passageId: p.id, reference: p.reference, success: false });
    }
    setResults(initResults);

    await runBatch(taskId, toTranslate);
  }

  async function runBatch(id: string | null, passages: PendingPassage[]) {
    let runningTokensIn = 0;
    let runningTokensOut = 0;
    let runningCost = 0;
    let runningSuccess = 0;
    let runningFail = 0;

    for (let i = 0; i < passages.length; i++) {
      if (cancelRef.current) {
        setStatusMessage("Cancelled.");
        if (id) await updateTaskProgress(id, runningSuccess, runningFail, runningTokensIn, runningTokensOut, runningCost, "cancelled");
        break;
      }

      while (pauseRef.current) {
        await new Promise((r) => setTimeout(r, 500));
        if (cancelRef.current) break;
      }
      if (cancelRef.current) {
        setStatusMessage("Cancelled.");
        if (id) await updateTaskProgress(id, runningSuccess, runningFail, runningTokensIn, runningTokensOut, runningCost, "cancelled");
        break;
      }

      const passage = passages[i];
      setStatusMessage(`Translating ${i + 1}/${passages.length}: ${passage.reference}...`);

      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passage_id: passage.id, target_language: targetLanguage }),
        });

        if (res.ok) {
          const data = await res.json();
          const tokensIn = data.usage?.tokens_input ?? 0;
          const tokensOut = data.usage?.tokens_output ?? 0;
          const costUsd = data.usage?.estimated_cost_usd ?? 0;
          runningTokensIn += tokensIn;
          runningTokensOut += tokensOut;
          runningCost += costUsd;
          runningSuccess++;
          setResults((prev) => {
            const next = new Map(prev);
            next.set(passage.id, { passageId: passage.id, reference: passage.reference, success: true, tokensIn, tokensOut, costUsd });
            return next;
          });
        } else {
          const errData = await res.json().catch(() => ({ error: "Unknown" }));
          runningFail++;
          setResults((prev) => {
            const next = new Map(prev);
            next.set(passage.id, { passageId: passage.id, reference: passage.reference, success: false, error: errData.error ?? `HTTP ${res.status}` });
            return next;
          });
        }
      } catch (err) {
        runningFail++;
        setResults((prev) => {
          const next = new Map(prev);
          next.set(passage.id, { passageId: passage.id, reference: passage.reference, success: false, error: err instanceof Error ? err.message : "Network error" });
          return next;
        });
      }

      if (id) await updateTaskProgress(id, runningSuccess, runningFail, runningTokensIn, runningTokensOut, runningCost);

      if (i < passages.length - 1 && !cancelRef.current) {
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_CALLS_MS));
      }
    }

    if (!cancelRef.current) {
      const finalStatus = runningFail > 0 && runningSuccess === 0 ? "failed" : "completed";
      if (id) await updateTaskProgress(id, runningSuccess, runningFail, runningTokensIn, runningTokensOut, runningCost, finalStatus);
      setStatusMessage(`Done. ${runningSuccess} translated, ${runningFail} failed. Cost: $${runningCost.toFixed(4)}`);
      setPhase("done");
    }

    setIsPaused(false);
  }

  async function handleRetryFailed() {
    const failed = allPassages.filter((p) => {
      const r = results.get(p.id);
      return r && !r.success;
    });
    if (failed.length === 0) return;

    cancelRef.current = false;
    pauseRef.current = false;
    setPhase("running");
    setStatusMessage(`Retrying ${failed.length} failed passages...`);
    await runBatch(taskId, failed);
  }

  const selectedToTranslate = allPassages.filter((p) => selectedPassageIds.has(p.id));
  const reTranslateCount = selectedToTranslate.filter((p) => p.is_translated).length;
  const progressPct = results.size > 0
    ? Math.round(((successCount + failCount) / results.size) * 100)
    : 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-700">Batch Translation</h2>
      <p className="mt-1 text-xs text-gray-500">
        Select a manuscript and target language, review passages, then translate.
      </p>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-gray-600">Manuscript</label>
          <select
            value={selectedMs}
            onChange={(e) => { setSelectedMs(e.target.value); setPhase("idle"); setAllPassages([]); setResults(new Map()); }}
            disabled={phase === "running" || phase === "scanning"}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">All manuscripts</option>
            {manuscripts.map((m) => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600">Target language</label>
          <select
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
            disabled={phase === "running" || phase === "scanning"}
            className="mt-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option>English</option>
            <option>Spanish</option>
            <option>French</option>
            <option>German</option>
            <option>Italian</option>
            <option>Portuguese</option>
            <option>Arabic</option>
            <option>Chinese</option>
            <option>Japanese</option>
          </select>
        </div>

        {(phase === "idle" || phase === "done") && (
          <button
            onClick={handleScan}
            className="rounded-md bg-primary-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-800 transition-colors"
          >
            Scan Passages
          </button>
        )}
        {phase === "scanning" && (
          <span className="flex items-center gap-1.5 text-sm text-gray-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-300 border-t-primary-700" />
            Scanning...
          </span>
        )}
      </div>

      {statusMessage && phase !== "selecting" && (
        <p className="mt-3 text-sm text-gray-600">{statusMessage}</p>
      )}

      {/* Passage selection phase */}
      {(phase === "selecting" || phase === "running" || phase === "done") && allPassages.length > 0 && (
        <div className="mt-4 space-y-3">
          {scanStats && (
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                <span className="font-medium text-gray-700">{scanStats.total}</span> passages found
                {scanStats.translated > 0 && (
                  <span className="ml-1">
                    — <span className="text-green-600">{scanStats.translated} already translated</span>
                  </span>
                )}
              </span>
              <span>{selectedPassageIds.size} selected</span>
            </div>
          )}

          {/* Selection controls */}
          {phase === "selecting" && (
            <div className="flex gap-2 flex-wrap">
              <button onClick={selectAllUntranslated} className="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-50">
                Select untranslated
              </button>
              <button onClick={selectAll} className="rounded border border-amber-200 px-2 py-0.5 text-xs text-amber-600 hover:bg-amber-50" title="Will overwrite existing translations">
                Select all (incl. re-translate)
              </button>
              <button onClick={selectNone} className="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-50">
                Select none
              </button>
            </div>
          )}

          {/* Passage list */}
          <div className="max-h-60 overflow-y-auto rounded-md border border-gray-100">
            {allPassages.map((p) => {
              const result = results.get(p.id);
              const isChecked = selectedPassageIds.has(p.id);
              return (
                <label
                  key={p.id}
                  className={`flex items-center gap-3 border-b border-gray-50 px-3 py-1.5 text-sm ${
                    p.is_translated ? "bg-green-50/40" : "hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => togglePassage(p.id)}
                    disabled={phase === "running"}
                    className="rounded border-gray-300 text-primary-700 focus:ring-primary-500"
                  />
                  <span className="flex-1 min-w-0 truncate font-medium text-gray-800">
                    {p.reference}
                  </span>
                  <span className="shrink-0">
                    {result ? (
                      result.success ? (
                        <span className="text-xs text-green-600">Translated ${result.costUsd?.toFixed(4)}</span>
                      ) : (
                        <span className="text-xs text-red-500 max-w-[160px] truncate" title={result.error}>{result.error ?? "Failed"}</span>
                      )
                    ) : p.is_translated ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-600">Translated</span>
                    ) : (
                      <span className="text-xs text-gray-400">pending</span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>

          {/* Progress */}
          {(phase === "running" || (phase === "done" && results.size > 0)) && (
            <div className="space-y-1.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div className="h-full rounded-full bg-primary-600 transition-all duration-300" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>
                  {successCount} done{failCount > 0 && `, ${failCount} failed`} / {results.size}
                  {statusMessage && ` — ${statusMessage}`}
                </span>
                <span>Cost: ${totalCost.toFixed(4)}</span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            {phase === "selecting" && (
              <button
                onClick={handleStart}
                disabled={selectedPassageIds.size === 0}
                className="rounded-md bg-primary-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-800 transition-colors disabled:opacity-50"
              >
                Translate {selectedPassageIds.size} Passage{selectedPassageIds.size !== 1 ? "s" : ""}
                {reTranslateCount > 0 && ` (${reTranslateCount} re-translate)`}
              </button>
            )}

            {phase === "running" && !isPaused && (
              <button onClick={() => { pauseRef.current = true; setIsPaused(true); }} className="rounded-md border border-amber-300 bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors">
                Pause
              </button>
            )}
            {phase === "running" && isPaused && (
              <button onClick={() => { pauseRef.current = false; setIsPaused(false); }} className="rounded-md bg-primary-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-800 transition-colors">
                Resume
              </button>
            )}
            {phase === "running" && (
              <button onClick={() => { cancelRef.current = true; pauseRef.current = false; setIsPaused(false); }} className="rounded-md border border-red-300 bg-red-50 px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors">
                Cancel
              </button>
            )}
            {phase === "done" && failCount > 0 && (
              <button onClick={handleRetryFailed} className="rounded-md bg-amber-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-700 transition-colors">
                Retry {failCount} Failed
              </button>
            )}
            {phase === "done" && (
              <button onClick={() => { setPhase("idle"); setAllPassages([]); setResults(new Map()); setScanStats(null); }} className="rounded-md border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Start Over
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
