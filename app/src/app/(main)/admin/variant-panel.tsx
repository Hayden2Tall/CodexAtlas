"use client";

import { useState } from "react";

interface DetectedVariant {
  passage_reference: string;
  description: string;
  readings: {
    manuscript_title: string;
    manuscript_id: string;
    reading_text: string;
    apparatus_notes: string;
  }[];
  significance: "major" | "minor" | "orthographic";
  analysis: string;
}

interface Passage {
  id: string;
  reference: string;
  manuscript_id: string;
  manuscript_title: string;
}

interface Props {
  passages: Passage[];
}

const SIGNIFICANCE_STYLES = {
  major: "bg-red-100 text-red-700",
  minor: "bg-amber-100 text-amber-700",
  orthographic: "bg-gray-100 text-gray-600",
};

export function VariantPanel({ passages }: Props) {
  const [mode, setMode] = useState<"reference" | "select">("reference");
  const [reference, setReference] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [variants, setVariants] = useState<DetectedVariant[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    variants_created: number;
    readings_created: number;
  } | null>(null);
  const [costInfo, setCostInfo] = useState<{
    tokens_input: number;
    tokens_output: number;
    estimated_cost_usd: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const uniqueRefs = [...new Set(passages.map((p) => p.reference))].sort();

  function togglePassage(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleDetect() {
    setIsDetecting(true);
    setVariants([]);
    setCostInfo(null);
    setSaveResult(null);
    setErrorMessage("");
    setInfoMessage("");

    const body: Record<string, unknown> = {};
    if (mode === "reference") {
      body.passage_reference = reference;
    } else {
      body.passage_ids = selectedIds;
    }

    try {
      const res = await fetch("/api/agent/detect-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error ?? "Detection failed");
      } else {
        setVariants(data.variants ?? []);
        setCostInfo(data.usage ?? null);
        if (data.message) setInfoMessage(data.message);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Network error"
      );
    }

    setIsDetecting(false);
  }

  async function handleSave() {
    if (variants.length === 0) return;

    setIsSaving(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/agent/detect-variants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variants }),
      });

      const data = await res.json();

      if (res.ok) {
        setSaveResult(data);
      } else {
        setErrorMessage(data.error ?? "Failed to save variants");
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Network error"
      );
    }

    setIsSaving(false);
  }

  const canDetect =
    mode === "reference"
      ? reference.length > 0
      : selectedIds.length >= 2;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        Variant Detection
      </h2>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Compare passages across manuscripts to identify textual variants using
        AI analysis.
      </p>

      {/* Mode selector */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setMode("reference")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === "reference"
              ? "bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-400"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
        >
          By Reference
        </button>
        <button
          onClick={() => setMode("select")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === "select"
              ? "bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-400"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
        >
          Select Passages
        </button>
      </div>

      {/* By reference */}
      {mode === "reference" && (
        <div className="mt-3">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
            Passage Reference
          </label>
          <div className="mt-1 flex gap-2">
            <select
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              disabled={isDetecting}
              className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 px-3 py-1.5 text-sm"
            >
              <option value="">Select a reference...</option>
              {uniqueRefs.map((ref) => {
                const count = passages.filter((p) => p.reference === ref).length;
                return (
                  <option key={ref} value={ref}>
                    {ref} ({count} manuscript{count !== 1 ? "s" : ""})
                  </option>
                );
              })}
            </select>
          </div>
          {reference && (
            <p className="mt-1 text-xs text-gray-400">
              Will compare {passages.filter((p) => p.reference === reference).length}{" "}
              passages with this reference.
            </p>
          )}
        </div>
      )}

      {/* Select passages */}
      {mode === "select" && (
        <div className="mt-3">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
            Select 2+ passages to compare
          </label>
          <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700 p-2">
            {passages.length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-400">
                No passages available
              </p>
            ) : (
              <div className="space-y-1">
                {passages.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(p.id)}
                      onChange={() => togglePassage(p.id)}
                      disabled={isDetecting}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-primary-700"
                    />
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {p.reference}
                    </span>
                    <span className="text-gray-400">
                      — {p.manuscript_title}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
          {selectedIds.length > 0 && (
            <p className="mt-1 text-xs text-gray-400">
              {selectedIds.length} selected
            </p>
          )}
        </div>
      )}

      {/* Detect button */}
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={handleDetect}
          disabled={isDetecting || !canDetect}
          className="rounded-md bg-primary-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-800 transition-colors disabled:opacity-50"
        >
          {isDetecting ? "Analyzing..." : "Detect Variants"}
        </button>
        {isDetecting && (
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-300 border-t-primary-700" />
            <span className="text-xs text-gray-500">
              Comparing texts...
            </span>
          </div>
        )}
      </div>

      {/* Error */}
      {errorMessage && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Cost info */}
      {costInfo && (
        <div className="mt-4 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span>
            Detection cost: ${costInfo.estimated_cost_usd.toFixed(4)}
          </span>
          <span>
            Tokens: {formatTokens(costInfo.tokens_input)} in /{" "}
            {formatTokens(costInfo.tokens_output)} out
          </span>
        </div>
      )}

      {/* Results */}
      {variants.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {variants.length} variant{variants.length !== 1 ? "s" : ""}{" "}
              detected
            </p>
            {saveResult ? (
              <span className="rounded-md bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                Saved: {saveResult.variants_created} variants,{" "}
                {saveResult.readings_created} readings
              </span>
            ) : (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-md bg-primary-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-800 transition-colors disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save All Variants"}
              </button>
            )}
          </div>

          <div className="space-y-3">
            {variants.map((v, i) => (
              <div
                key={`${v.passage_reference}-${i}`}
                className="rounded-md border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {v.passage_reference}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${SIGNIFICANCE_STYLES[v.significance]}`}
                  >
                    {v.significance}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{v.description}</p>

                <div className="mt-2 space-y-1">
                  {v.readings.map((r, ri) => (
                    <div
                      key={`${r.manuscript_id}-${ri}`}
                      className="flex gap-2 text-xs"
                    >
                      <span className="shrink-0 font-medium text-gray-500 dark:text-gray-400">
                        {r.manuscript_title}:
                      </span>
                      <span className="font-mono text-gray-800 dark:text-gray-200">
                        {r.reading_text}
                      </span>
                    </div>
                  ))}
                </div>

                {v.analysis && (
                  <p className="mt-2 text-xs italic text-gray-500 dark:text-gray-400">
                    {v.analysis}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!isDetecting && infoMessage && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {infoMessage}
        </div>
      )}

      {!isDetecting && variants.length === 0 && costInfo && !infoMessage && (
        <p className="mt-4 text-sm text-gray-500">
          No textual variants detected between the compared passages.
        </p>
      )}
    </div>
  );
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return count.toString();
}
