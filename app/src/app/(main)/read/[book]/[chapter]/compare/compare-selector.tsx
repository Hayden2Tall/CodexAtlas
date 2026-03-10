"use client";

import { useState } from "react";
import Link from "next/link";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { MethodBadge } from "@/components/ui/method-badge";

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
}

interface CompareSelectorProps {
  manuscripts: ManuscriptData[];
  book: string;
  chapter: number;
}

type ViewMode = "translation" | "original";

export function CompareSelector({ manuscripts }: CompareSelectorProps) {
  const [leftIdx, setLeftIdx] = useState(0);
  const [rightIdx, setRightIdx] = useState(Math.min(1, manuscripts.length - 1));
  const [viewMode, setViewMode] = useState<ViewMode>("translation");
  const [mobilePanel, setMobilePanel] = useState<"left" | "right">("left");

  const left = manuscripts[leftIdx];
  const right = manuscripts[rightIdx];

  function Panel({ data, side }: { data: ManuscriptData; side: "left" | "right" }) {
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
          {viewMode === "translation" ? (
            data.translatedText ? (
              <div>
                <p className="font-serif text-base leading-relaxed text-gray-800">
                  {data.translatedText}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {data.translationMethod && (
                    <MethodBadge method={data.translationMethod} />
                  )}
                  {data.confidenceScore != null && (
                    <ConfidenceBadge score={data.confidenceScore} />
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm italic text-gray-400">
                No published translation available
              </p>
            )
          ) : (
            <pre
              className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-gray-700"
              dir={["heb", "ara", "syc"].includes(data.language) ? "rtl" : "ltr"}
            >
              {data.originalText}
            </pre>
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
      </div>

      {/* Desktop: side by side */}
      <div className="hidden gap-4 md:grid md:grid-cols-2">
        <Panel data={left} side="left" />
        <Panel data={right} side="right" />
      </div>

      {/* Mobile: tabs */}
      <div className="md:hidden">
        <Panel
          data={mobilePanel === "left" ? left : right}
          side={mobilePanel}
        />
      </div>
    </div>
  );
}
