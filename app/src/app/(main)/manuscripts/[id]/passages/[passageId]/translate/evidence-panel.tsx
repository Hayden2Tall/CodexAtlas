"use client";

import { useState } from "react";
import type { EvidenceRecord, TranslationVersion } from "@/lib/types";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { MethodBadge } from "@/components/ui/method-badge";
import {
  getConfidenceLabel,
  formatMethodLabel,
} from "@/lib/utils/translation";

interface EvidencePanelProps {
  evidenceRecord: EvidenceRecord;
  version: TranslationVersion;
}

export function EvidencePanel({ evidenceRecord }: EvidencePanelProps) {
  const [showRaw, setShowRaw] = useState(false);

  const metadata = evidenceRecord.metadata as Record<string, unknown> | null;
  const notes = metadata?.translation_notes as string | undefined;
  const keyDecisions = metadata?.key_decisions as string[] | undefined;
  const sourceCount = evidenceRecord.source_manuscript_ids?.length ?? 0;
  const confidencePct =
    evidenceRecord.confidence_score != null
      ? Math.round(evidenceRecord.confidence_score * 100)
      : null;

  return (
    <div className="rounded-lg border border-primary-200 bg-primary-50/30">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="border-b border-primary-100 px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <svg
              className="size-4 text-primary-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
              />
            </svg>
            <h2 className="text-sm font-semibold text-primary-900">
              How do we know this?
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {evidenceRecord.confidence_score != null && (
              <ConfidenceBadge score={evidenceRecord.confidence_score} />
            )}
            {evidenceRecord.translation_method && (
              <MethodBadge method={evidenceRecord.translation_method} />
            )}
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────── */}
      <div className="space-y-4 px-5 py-4">
        {/* Transparency summary sentence */}
        <p className="text-sm leading-relaxed text-gray-700">
          This translation was produced by{" "}
          <span className="font-medium">
            {evidenceRecord.ai_model ?? "an unknown model"}
          </span>{" "}
          using{" "}
          <span className="font-medium">
            {formatMethodLabel(
              evidenceRecord.translation_method ?? "ai_initial"
            )}
          </span>{" "}
          from{" "}
          <span className="font-medium">
            {sourceCount} source manuscript
            {sourceCount !== 1 && "s"}
          </span>
          {confidencePct != null && (
            <>
              {" "}
              with{" "}
              <span className="font-medium">
                {confidencePct}% confidence (
                {getConfidenceLabel(evidenceRecord.confidence_score!)})
              </span>
            </>
          )}
          .
        </p>

        {/* Key details grid */}
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Detail
            label="Method"
            value={formatMethodLabel(
              evidenceRecord.translation_method ?? "unknown"
            )}
          />
          <Detail
            label="AI Model"
            value={evidenceRecord.ai_model ?? "\u2014"}
          />
          <Detail
            label="Sources"
            value={`${sourceCount} manuscript${sourceCount !== 1 ? "s" : ""}`}
          />
          <Detail
            label="Confidence"
            value={confidencePct != null ? `${confidencePct}%` : "\u2014"}
          />
        </dl>

        {/* Translation notes */}
        {notes && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Translation Notes
            </h3>
            <p className="text-sm leading-relaxed text-gray-700">{notes}</p>
          </div>
        )}

        {/* Key decisions */}
        {keyDecisions && keyDecisions.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Key Translation Decisions
            </h3>
            <ul className="space-y-1.5">
              {keyDecisions.map((decision, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary-400" />
                  {decision}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Revision reason */}
        {evidenceRecord.revision_reason && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Revision Reason
            </h3>
            <p className="text-sm text-gray-700">
              {evidenceRecord.revision_reason}
            </p>
          </div>
        )}

        {/* Raw evidence data toggle */}
        <div className="border-t border-primary-100 pt-3">
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="flex items-center gap-1 text-xs font-medium text-primary-600 transition-colors hover:text-primary-700"
          >
            <svg
              className={`size-3.5 transition-transform ${
                showRaw ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
            {showRaw ? "Hide" : "Show"} raw evidence data
          </button>

          {showRaw && (
            <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-gray-900 p-4 font-mono text-xs text-gray-300">
              {JSON.stringify(evidenceRecord, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-gray-900">{value}</dd>
    </div>
  );
}
