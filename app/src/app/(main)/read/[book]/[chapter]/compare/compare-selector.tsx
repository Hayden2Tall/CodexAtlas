"use client";

import { useState } from "react";
import Link from "next/link";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { MethodBadge } from "@/components/ui/method-badge";
import { computeWordDiff, type DiffSegment } from "@/lib/utils/diff";

interface ManuscriptData {
  passageId: string;
  manuscriptId: string;
  manuscriptTitle: string;
  language: string;
  dateLabel: string;
  originalText: string;
  translatedText: string | null;
  translationMethod: string | null;
  confidenceScore: number | null;
  translationNotes: string | null;
  keyDecisions: string[];
}

interface CompareSelectorProps {
  manuscripts: ManuscriptData[];
  book: string;
  chapter: number;
}

type ViewMode = "translation" | "diff" | "original";

function DiffText({ segments }: { segments: DiffSegment[] }) {
  return (
    <p className="font-serif text-base leading-relaxed text-gray-800">
      {segments.map((seg, i) => {
        if (seg.type === "same") return <span key={i}>{seg.text} </span>;
        if (seg.type === "removed")
          return (
            <span key={i} className="rounded bg-red-100 px-0.5 text-red-700 line-through">
              {seg.text}{" "}
            </span>
          );
        if (seg.type === "added")
          return (
            <span key={i} className="rounded bg-green-100 px-0.5 text-green-700">
              {seg.text}{" "}
            </span>
          );
        return <span key={i}>{seg.text} </span>;
      })}
    </p>
  );
}

function NotesSection({
  notes,
  decisions,
}: {
  notes: string | null;
  decisions: string[];
}) {
  const [open, setOpen] = useState(false);
  if (!notes && decisions.length === 0) return null;

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
      >
        <svg
          className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        Translation notes
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {notes && (
            <p className="text-xs leading-relaxed text-gray-600">{notes}</p>
          )}
          {decisions.length > 0 && (
            <ul className="space-y-1">
              {decisions.map((d, i) => (
                <li key={i} className="flex gap-1.5 text-xs text-gray-500">
                  <span className="mt-0.5 shrink-0 text-primary-400">·</span>
                  {d}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function CompareSelector({ manuscripts }: CompareSelectorProps) {
  const [leftIdx, setLeftIdx] = useState(0);
  const [rightIdx, setRightIdx] = useState(Math.min(1, manuscripts.length - 1));
  const [viewMode, setViewMode] = useState<ViewMode>("translation");
  const [mobilePanel, setMobilePanel] = useState<"left" | "right">("left");

  const left = manuscripts[leftIdx];
  const right = manuscripts[rightIdx];

  // Compute word diff between the two translations (only when both have text)
  const diffResult =
    viewMode === "diff" && left.translatedText && right.translatedText
      ? computeWordDiff(left.translatedText, right.translatedText)
      : null;

  function Panel({
    data,
    side,
    diffSegments,
  }: {
    data: ManuscriptData;
    side: "left" | "right";
    diffSegments?: DiffSegment[];
  }) {
    const otherIdx = side === "left" ? rightIdx : leftIdx;
    const setIdx = side === "left" ? setLeftIdx : setRightIdx;

    return (
      <div className="flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50/50 px-4 py-3">
          <select
            value={manuscripts.indexOf(data)}
            onChange={(e) => setIdx(parseInt(e.target.value, 10))}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            aria-label={`Select ${side} manuscript`}
          >
            {manuscripts.map((m, i) => (
              <option key={m.passageId} value={i} disabled={i === otherIdx}>
                {m.manuscriptTitle} {m.dateLabel ? `(${m.dateLabel})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 p-5">
          {viewMode === "original" ? (
            <pre
              className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-gray-700"
              dir={["heb", "ara", "syc"].includes(data.language) ? "rtl" : "ltr"}
            >
              {data.originalText}
            </pre>
          ) : data.translatedText ? (
            <div>
              {viewMode === "diff" && diffSegments ? (
                <DiffText segments={diffSegments} />
              ) : (
                <p className="font-serif text-base leading-relaxed text-gray-800">
                  {data.translatedText}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {data.translationMethod && (
                  <MethodBadge method={data.translationMethod} />
                )}
                {data.confidenceScore != null && (
                  <ConfidenceBadge score={data.confidenceScore} />
                )}
              </div>
              <NotesSection
                notes={data.translationNotes}
                decisions={data.keyDecisions}
              />
            </div>
          ) : (
            <p className="text-sm italic text-gray-400">
              No published translation available
            </p>
          )}
        </div>

        <div className="border-t border-gray-100 px-4 py-2.5">
          <Link
            href={`/manuscripts/${data.manuscriptId}/passages/${data.passageId}/translate`}
            className="text-xs text-primary-700 hover:underline"
          >
            View full evidence chain &rarr;
          </Link>
        </div>
      </div>
    );
  }

  const bothHaveTranslations = !!(left.translatedText && right.translatedText);

  return (
    <div>
      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
          <button
            onClick={() => setViewMode("translation")}
            className={`px-4 py-1.5 font-medium transition-colors ${
              viewMode === "translation"
                ? "bg-primary-700 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Translation
          </button>
          <button
            onClick={() => setViewMode("diff")}
            disabled={!bothHaveTranslations}
            title={bothHaveTranslations ? undefined : "Both manuscripts need translations to compare"}
            className={`px-4 py-1.5 font-medium transition-colors disabled:opacity-40 ${
              viewMode === "diff"
                ? "bg-primary-700 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Diff
          </button>
          <button
            onClick={() => setViewMode("original")}
            className={`px-4 py-1.5 font-medium transition-colors ${
              viewMode === "original"
                ? "bg-primary-700 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Original Text
          </button>
        </div>

        {/* Mobile tab selector */}
        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm md:hidden">
          <button
            onClick={() => setMobilePanel("left")}
            className={`px-4 py-1.5 font-medium transition-colors ${
              mobilePanel === "left"
                ? "bg-gray-800 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Panel 1
          </button>
          <button
            onClick={() => setMobilePanel("right")}
            className={`px-4 py-1.5 font-medium transition-colors ${
              mobilePanel === "right"
                ? "bg-gray-800 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Panel 2
          </button>
        </div>

        {viewMode === "diff" && bothHaveTranslations && (
          <p className="text-xs text-gray-500">
            <span className="rounded bg-green-100 px-1 text-green-700">green</span> = unique to this panel
            {" · "}
            <span className="rounded bg-red-100 px-1 text-red-700 line-through">red</span> = not in this panel
          </p>
        )}
      </div>

      {/* Desktop: side by side */}
      <div className="hidden gap-4 md:grid md:grid-cols-2">
        <Panel
          data={left}
          side="left"
          diffSegments={diffResult?.segmentsA}
        />
        <Panel
          data={right}
          side="right"
          diffSegments={diffResult?.segmentsB}
        />
      </div>

      {/* Mobile: tabs */}
      <div className="md:hidden">
        <Panel
          data={mobilePanel === "left" ? left : right}
          side={mobilePanel}
          diffSegments={
            mobilePanel === "left"
              ? diffResult?.segmentsA
              : diffResult?.segmentsB
          }
        />
      </div>
    </div>
  );
}
