"use client";

import { useState, useRef, useCallback } from "react";
import type { AgentTask, Passage } from "@/lib/types";

interface Props {
  onTaskCreated: (task: AgentTask) => void;
  onTaskUpdated: (task: AgentTask) => void;
}

type PendingPassage = Pick<Passage, "id" | "manuscript_id" | "reference" | "original_text">;

interface TranslationResult {
  passageId: string;
  reference: string;
  success: boolean;
  error?: string;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
}

const DELAY_BETWEEN_CALLS_MS = 1500;

export function BatchTranslatePanel({ onTaskCreated, onTaskUpdated }: Props) {
  const [targetLanguage, setTargetLanguage] = useState("English");
  const [isStarting, setIsStarting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPassage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<TranslationResult[]>([]);
  const [statusMessage, setStatusMessage] = useState("");

  const pauseRef = useRef(false);
  const cancelRef = useRef(false);

  const totalTokensIn = results.reduce((s, r) => s + (r.tokensIn ?? 0), 0);
  const totalTokensOut = results.reduce((s, r) => s + (r.tokensOut ?? 0), 0);
  const totalCost = results.reduce((s, r) => s + (r.costUsd ?? 0), 0);
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  const updateTaskProgress = useCallback(
    async (
      id: string,
      completed: number,
      failed: number,
      tIn: number,
      tOut: number,
      cost: number,
      status?: string,
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
        if (status === "completed" || status === "failed" || status === "cancelled") {
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

  async function handleStart() {
    setIsStarting(true);
    setResults([]);
    setCurrentIndex(0);
    setStatusMessage("Scanning for untranslated passages...");
    cancelRef.current = false;
    pauseRef.current = false;

    try {
      const res = await fetch("/api/agent/batch-translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_language: targetLanguage }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatusMessage(`Error: ${data.error}`);
        setIsStarting(false);
        return;
      }

      if (!data.task || data.pending_passages.length === 0) {
        setStatusMessage(data.message ?? "Nothing to translate.");
        setIsStarting(false);
        return;
      }

      setTaskId(data.task.id);
      setPending(data.pending_passages);
      onTaskCreated(data.task);
      setStatusMessage(
        `Found ${data.pending_passages.length} passages to translate (${data.already_translated} already done).`
      );
      setIsStarting(false);
      setIsRunning(true);

      await runBatch(data.task.id, data.pending_passages);
    } catch (err) {
      setStatusMessage(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
      setIsStarting(false);
    }
  }

  async function runBatch(id: string, passages: PendingPassage[]) {
    let runningTokensIn = 0;
    let runningTokensOut = 0;
    let runningCost = 0;
    let runningSuccess = 0;
    let runningFail = 0;

    for (let i = 0; i < passages.length; i++) {
      if (cancelRef.current) {
        setStatusMessage("Cancelled.");
        await updateTaskProgress(id, runningSuccess, runningFail, runningTokensIn, runningTokensOut, runningCost, "cancelled");
        break;
      }

      while (pauseRef.current) {
        await new Promise((r) => setTimeout(r, 500));
        if (cancelRef.current) break;
      }
      if (cancelRef.current) {
        setStatusMessage("Cancelled.");
        await updateTaskProgress(id, runningSuccess, runningFail, runningTokensIn, runningTokensOut, runningCost, "cancelled");
        break;
      }

      const passage = passages[i];
      setCurrentIndex(i);
      setStatusMessage(`Translating ${i + 1}/${passages.length}: ${passage.reference}...`);

      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            passage_id: passage.id,
            target_language: targetLanguage,
          }),
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

          setResults((prev) => [
            ...prev,
            {
              passageId: passage.id,
              reference: passage.reference,
              success: true,
              tokensIn,
              tokensOut,
              costUsd,
            },
          ]);
        } else {
          const errData = await res.json().catch(() => ({ error: "Unknown" }));
          runningFail++;
          setResults((prev) => [
            ...prev,
            {
              passageId: passage.id,
              reference: passage.reference,
              success: false,
              error: errData.error ?? `HTTP ${res.status}`,
            },
          ]);
        }
      } catch (err) {
        runningFail++;
        setResults((prev) => [
          ...prev,
          {
            passageId: passage.id,
            reference: passage.reference,
            success: false,
            error: err instanceof Error ? err.message : "Network error",
          },
        ]);
      }

      await updateTaskProgress(
        id,
        runningSuccess,
        runningFail,
        runningTokensIn,
        runningTokensOut,
        runningCost
      );

      if (i < passages.length - 1 && !cancelRef.current) {
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_CALLS_MS));
      }
    }

    if (!cancelRef.current) {
      const finalStatus = runningFail > 0 && runningSuccess === 0 ? "failed" : "completed";
      await updateTaskProgress(
        id,
        runningSuccess,
        runningFail,
        runningTokensIn,
        runningTokensOut,
        runningCost,
        finalStatus
      );
      setStatusMessage(
        `Done. ${runningSuccess} translated, ${runningFail} failed. Cost: $${runningCost.toFixed(4)}`
      );
    }

    setIsRunning(false);
    setIsPaused(false);
  }

  async function handleRetryFailed() {
    const failedPassageIds = new Set(
      results.filter((r) => !r.success).map((r) => r.passageId)
    );
    const failedPassages = pending.filter((p) => failedPassageIds.has(p.id));
    if (failedPassages.length === 0) return;

    setResults((prev) => prev.filter((r) => r.success));
    cancelRef.current = false;
    pauseRef.current = false;
    setIsRunning(true);
    setStatusMessage(`Retrying ${failedPassages.length} failed passages...`);

    if (taskId) {
      await runBatch(taskId, failedPassages);
    }
  }

  function handlePause() {
    pauseRef.current = true;
    setIsPaused(true);
    setStatusMessage("Paused. Click Resume to continue.");
  }

  function handleResume() {
    pauseRef.current = false;
    setIsPaused(false);
  }

  function handleCancel() {
    cancelRef.current = true;
    pauseRef.current = false;
    setIsPaused(false);
  }

  const progressPct =
    pending.length > 0
      ? Math.round(((successCount + failCount) / pending.length) * 100)
      : 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-700">
        Batch Translation
      </h2>
      <p className="mt-1 text-xs text-gray-500">
        Translate all untranslated passages. Runs client-side one at a time with
        rate limiting.
      </p>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor="target-lang"
            className="block text-xs font-medium text-gray-600"
          >
            Target language
          </label>
          <select
            id="target-lang"
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
            disabled={isRunning || isStarting}
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

        {!isRunning && !isStarting && (
          <button
            onClick={handleStart}
            className="rounded-md bg-primary-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-800 transition-colors"
          >
            Start Batch
          </button>
        )}

        {isRunning && !isPaused && (
          <button
            onClick={handlePause}
            className="rounded-md border border-amber-300 bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors"
          >
            Pause
          </button>
        )}

        {isRunning && isPaused && (
          <button
            onClick={handleResume}
            className="rounded-md bg-primary-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-800 transition-colors"
          >
            Resume
          </button>
        )}

        {isRunning && (
          <button
            onClick={handleCancel}
            className="rounded-md border border-red-300 bg-red-50 px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
          >
            Cancel
          </button>
        )}

        {!isRunning && !isStarting && failCount > 0 && (
          <button
            onClick={handleRetryFailed}
            className="rounded-md bg-amber-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
          >
            Retry {failCount} Failed
          </button>
        )}

        {isStarting && (
          <span className="text-sm text-gray-500">Scanning...</span>
        )}
      </div>

      {/* Progress */}
      {(isRunning || results.length > 0) && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>{statusMessage}</span>
            <span>
              {successCount + failCount}/{pending.length} ({progressPct}%)
            </span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-primary-600 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="flex gap-6 text-xs text-gray-500">
            <span>
              Tokens: {formatTokens(totalTokensIn)} in / {formatTokens(totalTokensOut)} out
            </span>
            <span>Cost: ${totalCost.toFixed(4)}</span>
            {failCount > 0 && (
              <span className="text-red-600">{failCount} failed</span>
            )}
          </div>
        </div>
      )}

      {/* Results log */}
      {results.length > 0 && (
        <div className="mt-4 max-h-60 overflow-y-auto rounded-md border border-gray-100 bg-gray-50 p-3">
          <div className="space-y-1">
            {results.map((r, i) => (
              <div
                key={`${r.passageId}-${i}`}
                className={`flex items-center justify-between text-xs ${
                  r.success ? "text-gray-600" : "text-red-600"
                }`}
              >
                <span className="truncate">
                  {r.success ? "\u2713" : "\u2717"} {r.reference}
                </span>
                {r.success ? (
                  <span className="shrink-0 text-gray-400">
                    ${r.costUsd?.toFixed(4)}
                  </span>
                ) : (
                  <span className="shrink-0">{r.error}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!isRunning && !isStarting && statusMessage && results.length === 0 && (
        <p className="mt-3 text-sm text-gray-600">{statusMessage}</p>
      )}
    </div>
  );
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return count.toString();
}
