"use client";

import { useState } from "react";
import type { TranslationVersion, EvidenceRecord } from "@/lib/types";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { MethodBadge } from "@/components/ui/method-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { VersionIndicator } from "@/components/ui/version-indicator";

interface VersionHistoryProps {
  versions: TranslationVersion[];
  currentVersionId: string | null;
  activeVersionId: string | null;
  onSelectVersion: (id: string) => void;
  evidenceRecords: EvidenceRecord[];
}

export function VersionHistory({
  versions,
  currentVersionId,
  activeVersionId,
  onSelectVersion,
  evidenceRecords,
}: VersionHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-900">
          Version History
        </h2>
        <p className="text-xs text-gray-500">
          {versions.length} version{versions.length !== 1 && "s"}
        </p>
      </div>

      <div className="divide-y divide-gray-100">
        {versions.map((version, index) => {
          const isActive = version.id === activeVersionId;
          const isCurrent = version.id === currentVersionId;
          const isExpanded = expandedId === version.id;
          const isLast = index === versions.length - 1;
          const evidence = version.evidence_record_id
            ? evidenceRecords.find(
                (e) => e.id === version.evidence_record_id
              )
            : null;

          return (
            <div
              key={version.id}
              className={`transition-colors ${
                isActive ? "bg-primary-50/50" : "hover:bg-gray-50"
              }`}
            >
              <button
                onClick={() => onSelectVersion(version.id)}
                className="flex w-full items-start gap-4 px-5 py-3 text-left"
              >
                {/* Timeline dot + line */}
                <div className="flex flex-col items-center pt-1">
                  <div
                    className={`size-3 shrink-0 rounded-full border-2 ${
                      isCurrent
                        ? "border-primary-600 bg-primary-600"
                        : "border-gray-300 bg-white"
                    }`}
                  />
                  {!isLast && (
                    <div className="mt-1 h-8 w-px bg-gray-200" />
                  )}
                </div>

                {/* Version metadata */}
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <VersionIndicator
                    version={version.version_number}
                    isCurrent={isCurrent}
                  />
                  <MethodBadge method={version.translation_method} />
                  {version.confidence_score != null && (
                    <ConfidenceBadge score={version.confidence_score} />
                  )}
                  <StatusBadge status={version.status} />
                  <span className="ml-auto text-xs text-gray-400">
                    {new Date(version.created_at).toLocaleDateString(
                      "en-US",
                      { year: "numeric", month: "short", day: "numeric" }
                    )}
                  </span>
                </div>

                {/* Expand/collapse */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedId(isExpanded ? null : version.id);
                  }}
                  className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-label={isExpanded ? "Collapse" : "Expand"}
                >
                  <svg
                    className={`size-4 transition-transform ${
                      isExpanded ? "rotate-180" : ""
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
                </button>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-4 pl-14">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                    {version.translated_text}
                  </p>
                  {version.revision_reason && (
                    <p className="mt-3 text-xs text-gray-500">
                      <span className="font-medium">Revision reason:</span>{" "}
                      {version.revision_reason}
                    </p>
                  )}
                  {evidence && (
                    <p className="mt-2 text-xs text-gray-400">
                      Translated by{" "}
                      {evidence.ai_model ?? "unknown model"} from{" "}
                      {evidence.source_manuscript_ids?.length ?? 0} source
                      manuscript
                      {(evidence.source_manuscript_ids?.length ?? 0) !== 1 &&
                        "s"}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
