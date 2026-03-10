"use client";

import { useState } from "react";
import type { Passage } from "@/lib/types";

interface SourceChainStep {
  step: number;
  source: string;
  result: string;
  reason: string;
  ms?: number;
}

const SOURCE_DISPLAY: Record<
  string,
  { label: string; description: string; tier: "manuscript" | "edition" | "ai" }
> = {
  "sinaiticus-project": {
    label: "Codex Sinaiticus Project",
    description: "Manuscript-specific transcription from the Codex Sinaiticus Project XML (CC BY-NC-SA 3.0)",
    tier: "manuscript",
  },
  ntvmr: {
    label: "INTF NTVMR",
    description: "Scholarly transcription from the Institute for New Testament Textual Research Virtual Manuscript Room",
    tier: "manuscript",
  },
  dss: {
    label: "Dead Sea Scrolls (ETCBC)",
    description: "Hebrew text from the ETCBC Dead Sea Scrolls corpus (CC BY-NC 4.0)",
    tier: "manuscript",
  },
  "leningrad-wlc": {
    label: "Westminster Leningrad Codex",
    description: "Standard Hebrew text recognized as manuscript-specific for the Leningrad Codex",
    tier: "manuscript",
  },
  sblgnt: {
    label: "SBLGNT",
    description: "Society of Biblical Literature Greek New Testament critical edition",
    tier: "edition",
  },
  "bible-api": {
    label: "Standard Edition",
    description: "Standard scholarly edition text (LXX, Textus Receptus, or WLC) via the bolls.life Bible API",
    tier: "edition",
  },
  ai: {
    label: "AI Generated",
    description: "Text reconstructed by Claude AI models when no direct scholarly source was available",
    tier: "ai",
  },
};

const TIER_STYLES = {
  manuscript: "bg-green-50 text-green-700 border-green-200",
  edition: "bg-blue-50 text-blue-700 border-blue-200",
  ai: "bg-amber-50 text-amber-700 border-amber-200",
};

const TIER_LABELS = {
  manuscript: "Manuscript-Specific",
  edition: "Standard Edition",
  ai: "AI Reconstructed",
};

const RESULT_ICON: Record<string, { icon: string; color: string }> = {
  success: { icon: "✓", color: "text-green-600" },
  not_applicable: { icon: "—", color: "text-gray-400" },
  skipped: { icon: "—", color: "text-gray-400" },
  no_data: { icon: "✗", color: "text-red-400" },
  wrong_script: { icon: "✗", color: "text-amber-500" },
};

function getTranscriptionLabel(method: string | null): string | null {
  switch (method) {
    case "scholarly_transcription":
      return "Scholarly transcription";
    case "standard_edition":
      return "Standard scholarly edition";
    case "ai_imported":
      return "AI-imported text";
    case "ai_reconstructed":
      return "AI-reconstructed text";
    case "manual":
      return "Manually entered";
    case "ocr_auto":
      return "OCR (automatic)";
    case "ocr_reviewed":
      return "OCR (reviewed)";
    default:
      return null;
  }
}

export function TextProvenance({ passage }: { passage: Passage }) {
  const [expanded, setExpanded] = useState(false);

  const meta = passage.metadata as Record<string, unknown> | null;
  const sourceChain = meta?.source_chain as SourceChainStep[] | undefined;
  const successStep = sourceChain?.find((s) => s.result === "success");
  const sourceKey = successStep?.source;
  const sourceInfo = sourceKey ? SOURCE_DISPLAY[sourceKey] : null;
  const transcriptionLabel = getTranscriptionLabel(
    passage.transcription_method
  );

  if (!sourceChain && !transcriptionLabel) return null;

  const tier = sourceInfo?.tier ?? "edition";

  return (
    <div className="border-t border-gray-100">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-5 py-3 text-left text-xs transition-colors hover:bg-gray-50"
      >
        <svg
          className="size-3.5 shrink-0 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
          />
        </svg>
        <span className="font-medium text-gray-600">Text Source</span>
        {sourceInfo && (
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${TIER_STYLES[tier]}`}
          >
            {TIER_LABELS[tier]}
          </span>
        )}
        <span className="ml-auto text-gray-400">
          {expanded ? "▴" : "▾"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-gray-50 bg-gray-50/50 px-5 py-3 text-xs">
          {/* Primary source */}
          {sourceInfo && (
            <div className="mb-3">
              <p className="font-medium text-gray-700">
                {sourceInfo.label}
              </p>
              <p className="mt-0.5 text-gray-500">
                {sourceInfo.description}
              </p>
            </div>
          )}

          {transcriptionLabel && !sourceInfo && (
            <div className="mb-3">
              <p className="font-medium text-gray-700">
                {transcriptionLabel}
              </p>
            </div>
          )}

          {/* Full chain reasoning */}
          {sourceChain && sourceChain.length > 0 && (
            <div>
              <p className="mb-1.5 font-medium text-gray-500">
                Source resolution chain
              </p>
              <div className="space-y-1">
                {sourceChain.map((step) => {
                  const ri = RESULT_ICON[step.result] ?? RESULT_ICON.no_data;
                  return (
                    <div
                      key={step.step}
                      className="flex items-start gap-2"
                    >
                      <span
                        className={`inline-block w-3.5 shrink-0 text-center font-mono ${ri.color}`}
                      >
                        {ri.icon}
                      </span>
                      <span className="min-w-[100px] font-medium text-gray-600">
                        {SOURCE_DISPLAY[step.source]?.label ?? step.source}
                      </span>
                      <span className="flex-1 text-gray-500">
                        {step.reason}
                        {step.ms ? ` (${step.ms}ms)` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!sourceChain && (
            <p className="text-gray-400">
              No source chain data available for this passage.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
