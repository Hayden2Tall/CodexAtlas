"use client";

import { useState } from "react";
import { BulkTranslateTrigger } from "@/components/admin/bulk-translate-trigger";

interface PassageRef {
  id: string;
  reference: string;
}

interface Props {
  untranslatedPassages: PassageRef[];
  allPassages: PassageRef[];
  totalManuscripts: number;
}

export function ChapterAdminBar({ untranslatedPassages, allPassages, totalManuscripts }: Props) {
  const [showRetranslate, setShowRetranslate] = useState(false);

  // Not shown if no passages at all (non-admin path sends empty allPassages)
  if (allPassages.length === 0) return null;

  const hasUntranslated = untranslatedPassages.length > 0;

  return (
    <div className={`mb-6 rounded-lg border px-4 py-3 ${
      hasUntranslated
        ? "border-amber-200 bg-amber-50"
        : "border-gray-200 bg-gray-50"
    }`}>
      {hasUntranslated && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-amber-800">
            <span className="font-medium">{untranslatedPassages.length}</span> of{" "}
            <span className="font-medium">{totalManuscripts}</span> manuscript
            {totalManuscripts !== 1 ? "s" : ""} in this chapter have no published translation.
          </p>
          <BulkTranslateTrigger
            passages={untranslatedPassages}
            label="untranslated"
            size="sm"
          />
        </div>
      )}

      {/* Re-translate section — always available */}
      <div className={hasUntranslated ? "mt-3 border-t border-amber-100 pt-3" : ""}>
        <button
          onClick={() => setShowRetranslate((v) => !v)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
        >
          <svg
            className={`h-3 w-3 transition-transform ${showRetranslate ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          Re-translate all {totalManuscripts} manuscript{totalManuscripts !== 1 ? "s" : ""}
        </button>
        {showRetranslate && (
          <div className="mt-2">
            <BulkTranslateTrigger
              passages={allPassages}
              label="for this chapter"
              size="sm"
            />
          </div>
        )}
      </div>
    </div>
  );
}
