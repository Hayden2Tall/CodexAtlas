"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface Passage {
  id: string;
  reference: string;
}

interface BulkTranslateTriggerProps {
  passages: Passage[];
  label?: string;
  size?: "sm" | "md";
}

const COST_PER_PASSAGE = 0.0115; // Conservative Sonnet 4 estimate (~$3/MTok input + $15/MTok output)
const WARN_COUNT = 10;
const WARN_COST = 5.0;
const DELAY_BETWEEN_MS = 1500;
const RETRY_DELAY_MS = 2000;

const LANGUAGES = ["English", "Spanish", "French", "German", "Italian", "Portuguese", "Arabic", "Chinese", "Japanese"];

type Phase = "idle" | "confirming" | "running" | "done";

export function BulkTranslateTrigger({ passages, label = "", size = "md" }: BulkTranslateTriggerProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [language, setLanguage] = useState("English");
  const [currentRef, setCurrentRef] = useState("");
  const [progress, setProgress] = useState({ done: 0, failed: 0, total: 0 });
  const [failedRefs, setFailedRefs] = useState<string[]>([]);
  const cancelRef = useRef(false);

  const estimatedCost = passages.length * COST_PER_PASSAGE;
  const needsConfirm = passages.length > WARN_COUNT || estimatedCost > WARN_COST;

  function handleClick() {
    if (passages.length === 0) return;
    if (needsConfirm) {
      setPhase("confirming");
    } else {
      startTranslation();
    }
  }

  async function startTranslation() {
    cancelRef.current = false;
    setPhase("running");
    setProgress({ done: 0, failed: 0, total: passages.length });
    setFailedRefs([]);

    let done = 0;
    let failed = 0;
    const newFailedRefs: string[] = [];

    const attemptFetch = (passageId: string) =>
      fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passage_id: passageId, target_language: language }),
      });

    for (let i = 0; i < passages.length; i++) {
      if (cancelRef.current) break;

      const passage = passages[i];
      setCurrentRef(passage.reference);

      try {
        let res = await attemptFetch(passage.id);

        if (!res.ok) {
          // Retry once
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          if (cancelRef.current) break;
          res = await attemptFetch(passage.id);
        }

        if (res.ok) {
          done++;
        } else {
          failed++;
          newFailedRefs.push(passage.reference);
        }
      } catch {
        failed++;
        newFailedRefs.push(passage.reference);
      }

      setProgress({ done, failed, total: passages.length });
      setFailedRefs([...newFailedRefs]);

      if (i < passages.length - 1 && !cancelRef.current) {
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_MS));
      }
    }

    setCurrentRef("");
    setPhase("done");
    router.refresh();
  }

  function reset() {
    setPhase("idle");
    setProgress({ done: 0, failed: 0, total: 0 });
    setFailedRefs([]);
    setCurrentRef("");
    cancelRef.current = false;
  }

  const isSmall = size === "sm";

  if (phase === "confirming") {
    return (
      <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm">
        <p className="text-amber-900 dark:text-amber-200 font-medium">
          Translate {passages.length} passage{passages.length !== 1 ? "s" : ""}{label ? ` ${label}` : ""} to {language}?
        </p>
        <p className="mt-1 text-amber-700 dark:text-amber-400 text-xs">
          Estimated cost: ~${estimatedCost.toFixed(2)}. Each passage will call the AI translation API.
        </p>
        <div className="mt-2 flex gap-2">
          <button
            onClick={startTranslation}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
          >
            Confirm &amp; Translate
          </button>
          <button
            onClick={() => setPhase("idle")}
            className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (phase === "running") {
    const pct = progress.total > 0 ? Math.round(((progress.done + progress.failed) / progress.total) * 100) : 0;
    return (
      <div className="space-y-2 w-full">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div className="h-full rounded-full bg-primary-600 transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            {progress.done + progress.failed} / {progress.total}
            {progress.failed > 0 && <span className="ml-1 text-red-500">· {progress.failed} failed</span>}
            {currentRef && <span className="ml-1 text-gray-400">— {currentRef}</span>}
          </span>
          <button
            onClick={() => { cancelRef.current = true; }}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="space-y-1 text-xs">
        <p className="text-green-700 dark:text-green-400 font-medium">
          {progress.done} passage{progress.done !== 1 ? "s" : ""} translated.
          {progress.failed > 0 && (
            <span className="ml-1 text-red-600">{progress.failed} failed.</span>
          )}
        </p>
        {failedRefs.length > 0 && (
          <p className="text-red-500 truncate" title={failedRefs.join(", ")}>
            Failed: {failedRefs.slice(0, 3).join(", ")}{failedRefs.length > 3 ? ` +${failedRefs.length - 3} more` : ""}
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="text-xs text-primary-600 hover:underline"
          >
            Reset
          </button>
          <button
            onClick={() => router.refresh()}
            className="text-xs text-gray-500 hover:underline"
          >
            Refresh page
          </button>
        </div>
      </div>
    );
  }

  // idle
  return (
    <div className={`flex items-center gap-2 ${isSmall ? "flex-wrap" : ""}`}>
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className={`rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-100 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 ${isSmall ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"}`}
      >
        {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
      </select>
      <button
        onClick={handleClick}
        disabled={passages.length === 0}
        className={`whitespace-nowrap rounded-md font-medium transition-colors disabled:opacity-50 ${
          needsConfirm
            ? "border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            : "bg-primary-700 text-white hover:bg-primary-800"
        } ${isSmall ? "px-2.5 py-1 text-xs" : "px-4 py-1.5 text-sm"}`}
      >
        Translate {passages.length} passage{passages.length !== 1 ? "s" : ""}
        {label ? ` ${label}` : ""}
        {" "}— ~${estimatedCost.toFixed(2)}
        {needsConfirm && " ⚠"}
      </button>
    </div>
  );
}
