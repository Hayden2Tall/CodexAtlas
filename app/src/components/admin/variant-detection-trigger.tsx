"use client";

import { useState } from "react";

interface PassageRef {
  id: string;
  reference: string;
}

interface DetectedVariant {
  passage_reference: string;
  description: string;
  significance: "major" | "minor" | "orthographic";
  readings: { manuscript_title: string; reading_text: string }[];
}

interface VariantDetectionTriggerProps {
  passages: PassageRef[];
  label?: string;
}

type Phase = "idle" | "detecting" | "review" | "saving" | "done";

export function VariantDetectionTrigger({ passages, label = "" }: VariantDetectionTriggerProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [variants, setVariants] = useState<DetectedVariant[]>([]);
  const [saveResult, setSaveResult] = useState<{ variants_created: number; readings_created: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (passages.length < 2) return null;

  async function handleDetect() {
    setPhase("detecting");
    setVariants([]);
    setSaveResult(null);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch("/api/agent/detect-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passage_ids: passages.map((p) => p.id) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Detection failed");
        setPhase("idle");
      } else {
        setVariants(data.variants ?? []);
        if (data.message) setInfo(data.message);
        setPhase("review");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setPhase("idle");
    }
  }

  async function handleSave() {
    if (variants.length === 0) return;
    setPhase("saving");
    setError(null);
    try {
      const res = await fetch("/api/agent/detect-variants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variants }),
      });
      const data = await res.json();
      if (res.ok) {
        setSaveResult(data);
        setPhase("done");
      } else {
        setError(data.error ?? "Failed to save variants");
        setPhase("review");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setPhase("review");
    }
  }

  if (phase === "detecting") {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-primary-700" />
        Analyzing {passages.length} passages for variants…
      </div>
    );
  }

  if (phase === "review") {
    return (
      <div className="space-y-2">
        {variants.length === 0 ? (
          <p className="text-xs text-gray-500">
            {info ?? "No textual variants detected between these passages."}
          </p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-700">
                {variants.length} variant{variants.length !== 1 ? "s" : ""} detected
              </span>
              <button
                onClick={handleSave}
                className="rounded-md bg-primary-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-800 transition-colors"
              >
                Save all
              </button>
              <button
                onClick={() => setPhase("idle")}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Discard
              </button>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {variants.map((v, i) => (
                <div key={i} className="rounded-md bg-gray-50 px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-gray-700">{v.passage_reference}</span>
                    <span className={`rounded-full px-1.5 py-0 text-[9px] font-semibold ${
                      v.significance === "major"
                        ? "bg-red-100 text-red-700"
                        : v.significance === "minor"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-gray-100 text-gray-600"
                    }`}>
                      {v.significance}
                    </span>
                  </div>
                  <p className="mt-0.5 text-gray-500">{v.description}</p>
                </div>
              ))}
            </div>
          </>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  if (phase === "saving") {
    return <p className="text-xs text-gray-500">Saving variants…</p>;
  }

  if (phase === "done") {
    return (
      <div className="flex items-center gap-3 text-xs">
        <span className="text-green-700 font-medium">
          Saved {saveResult?.variants_created ?? 0} variants, {saveResult?.readings_created ?? 0} readings
        </span>
        <button onClick={() => { setPhase("idle"); setSaveResult(null); }} className="text-gray-400 hover:text-gray-600">
          Reset
        </button>
      </div>
    );
  }

  // idle
  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={handleDetect}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary-700"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
        Detect variants{label ? ` ${label}` : ""} ({passages.length} passages)
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
