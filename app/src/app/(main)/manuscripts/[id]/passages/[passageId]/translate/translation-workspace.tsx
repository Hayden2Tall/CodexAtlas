"use client";

import { useState } from "react";
import type {
  Passage,
  Manuscript,
  Translation,
  TranslationVersion,
  EvidenceRecord,
} from "@/lib/types";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { MethodBadge } from "@/components/ui/method-badge";
import { VersionIndicator } from "@/components/ui/version-indicator";
import { VersionHistory } from "./version-history";
import { EvidencePanel } from "./evidence-panel";

interface TranslationWorkspaceProps {
  passage: Passage;
  manuscript: Manuscript;
  translations: Translation[];
  versions: TranslationVersion[];
  evidenceRecords: EvidenceRecord[];
}

const TARGET_LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Modern Hebrew",
  "Modern Arabic",
  "Latin",
];

export function TranslationWorkspace({
  passage,
  manuscript,
  translations: initialTranslations,
  versions: initialVersions,
  evidenceRecords: initialEvidence,
}: TranslationWorkspaceProps) {
  const [translations, setTranslations] = useState(initialTranslations);
  const [versions, setVersions] = useState(initialVersions);
  const [evidenceRecords, setEvidenceRecords] = useState(initialEvidence);
  const [targetLanguage, setTargetLanguage] = useState("English");
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

  const currentTranslation = translations.find(
    (t) => t.target_language === targetLanguage
  );

  const currentVersions = versions
    .filter(
      (v) => currentTranslation && v.translation_id === currentTranslation.id
    )
    .sort((a, b) => b.version_number - a.version_number);

  const latestVersion = currentVersions[0] ?? null;

  const activeVersion = activeVersionId
    ? versions.find((v) => v.id === activeVersionId)
    : latestVersion;

  const activeEvidence = activeVersion?.evidence_record_id
    ? evidenceRecords.find((e) => e.id === activeVersion.evidence_record_id)
    : null;

  async function handleTranslate() {
    setIsTranslating(true);
    setError(null);

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passage_id: passage.id,
          target_language: targetLanguage,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Translation failed");
      }

      const data = await res.json();

      setTranslations((prev) => {
        const exists = prev.find((t) => t.id === data.translation.id);
        return exists
          ? prev.map((t) =>
              t.id === data.translation.id ? data.translation : t
            )
          : [...prev, data.translation];
      });
      setVersions((prev) => [...prev, data.version]);
      setEvidenceRecords((prev) => [...prev, data.evidence_record]);
      setActiveVersionId(data.version.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Translation failed");
    } finally {
      setIsTranslating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Language selector + action ─────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4">
        <label
          htmlFor="target-lang"
          className="text-sm font-medium text-gray-700"
        >
          Target Language
        </label>
        <select
          id="target-lang"
          value={targetLanguage}
          onChange={(e) => {
            setTargetLanguage(e.target.value);
            setActiveVersionId(null);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          {TARGET_LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>

        <button
          onClick={handleTranslate}
          disabled={isTranslating}
          className="ml-auto rounded-lg bg-primary-700 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isTranslating ? (
            <span className="flex items-center gap-2">
              <Spinner />
              Translating&hellip;
            </span>
          ) : (
            "Generate AI Translation"
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Two-panel layout ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Original text */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Original Text
            </h2>
            <p className="text-xs text-gray-500">
              {manuscript.original_language} &mdash; {passage.reference}
            </p>
          </div>
          <div className="p-5">
            <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-gray-800">
              {passage.original_text}
            </pre>
          </div>
        </div>

        {/* Translation output */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  Translation
                </h2>
                <p className="text-xs text-gray-500">{targetLanguage}</p>
              </div>
              {activeVersion && (
                <div className="flex flex-wrap items-center gap-2">
                  <VersionIndicator
                    version={activeVersion.version_number}
                    isCurrent={
                      activeVersion.id ===
                      currentTranslation?.current_version_id
                    }
                  />
                  <MethodBadge method={activeVersion.translation_method} />
                  {activeVersion.confidence_score != null && (
                    <ConfidenceBadge score={activeVersion.confidence_score} />
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="p-5">
            {isTranslating ? (
              <div className="flex items-center justify-center py-12 text-sm text-gray-400">
                <Spinner className="mr-2 size-5 text-primary-600" />
                Generating scholarly translation&hellip;
              </div>
            ) : activeVersion ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                {activeVersion.translated_text}
              </p>
            ) : (
              <p className="py-12 text-center text-sm text-gray-400">
                No translation yet. Click &ldquo;Generate AI
                Translation&rdquo; to begin.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Evidence panel ────────────────────────────────────────── */}
      {activeVersion && activeEvidence && (
        <EvidencePanel
          evidenceRecord={activeEvidence}
          version={activeVersion}
        />
      )}

      {/* ── Version history ───────────────────────────────────────── */}
      {currentVersions.length > 0 && (
        <VersionHistory
          versions={currentVersions}
          currentVersionId={currentTranslation?.current_version_id ?? null}
          activeVersionId={activeVersionId}
          onSelectVersion={setActiveVersionId}
          evidenceRecords={evidenceRecords}
        />
      )}
    </div>
  );
}

function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
