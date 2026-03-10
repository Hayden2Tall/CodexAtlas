"use client";

import { useState } from "react";
import type { TranslationVersion, EvidenceRecord } from "@/lib/types";

interface ConfidenceExplanationProps {
  version: TranslationVersion;
  evidenceRecord: EvidenceRecord | null;
  reviewCount: number;
}

interface Factor {
  label: string;
  detail: string;
  impact: "positive" | "neutral" | "negative";
}

function deriveFactors(
  version: TranslationVersion,
  evidence: EvidenceRecord | null,
  reviewCount: number
): Factor[] {
  const factors: Factor[] = [];
  const score = version.confidence_score ?? 0;

  if (version.translation_method === "human") {
    factors.push({ label: "Human translation", detail: "Produced by a human translator, not AI", impact: "positive" });
  } else if (version.translation_method === "hybrid") {
    factors.push({ label: "Hybrid translation", detail: "AI-assisted with human review and editing", impact: "positive" });
  } else if (version.translation_method === "ai_revised") {
    factors.push({ label: "AI revised", detail: "AI translation that has been revised based on feedback", impact: "neutral" });
  } else {
    factors.push({ label: "AI initial translation", detail: "First-pass AI translation without human revision", impact: "negative" });
  }

  if (evidence?.ai_model) {
    factors.push({
      label: `Model: ${evidence.ai_model}`,
      detail: evidence.ai_model.includes("sonnet") ? "Higher-capability model used" : "Fast model used for cost efficiency",
      impact: evidence.ai_model.includes("sonnet") ? "positive" : "neutral",
    });
  }

  const sourceCount = evidence?.source_manuscript_ids?.length ?? 0;
  if (sourceCount > 1) {
    factors.push({ label: `${sourceCount} source manuscripts`, detail: "Multiple manuscripts corroborate the translation", impact: "positive" });
  } else if (sourceCount === 1) {
    factors.push({ label: "Single source manuscript", detail: "Only one manuscript source available", impact: "neutral" });
  }

  if (version.version_number > 1) {
    factors.push({ label: `Version ${version.version_number}`, detail: "Multiple translation iterations suggest refinement", impact: "positive" });
  } else {
    factors.push({ label: "First version", detail: "No subsequent revisions yet", impact: "neutral" });
  }

  if (reviewCount > 0) {
    factors.push({ label: `${reviewCount} review${reviewCount !== 1 ? "s" : ""}`, detail: "Peer review strengthens confidence", impact: "positive" });
  } else {
    factors.push({ label: "No reviews yet", detail: "Peer review would strengthen confidence", impact: "negative" });
  }

  if (score >= 0.85) {
    factors.push({ label: "High confidence", detail: "Score indicates strong alignment between source and translation", impact: "positive" });
  } else if (score >= 0.6) {
    factors.push({ label: "Moderate confidence", detail: "Score suggests reasonable but improvable translation quality", impact: "neutral" });
  } else if (score > 0) {
    factors.push({ label: "Low confidence", detail: "Score suggests this translation needs review or revision", impact: "negative" });
  }

  return factors;
}

const impactIcons: Record<Factor["impact"], { color: string; symbol: string }> = {
  positive: { color: "text-green-600", symbol: "+" },
  neutral: { color: "text-gray-400", symbol: "~" },
  negative: { color: "text-amber-600", symbol: "!" },
};

export function ConfidenceExplanation({
  version,
  evidenceRecord,
  reviewCount,
}: ConfidenceExplanationProps) {
  const [expanded, setExpanded] = useState(false);
  const factors = deriveFactors(version, evidenceRecord, reviewCount);

  const improvementTips: string[] = [];
  if (reviewCount === 0) improvementTips.push("Submit a peer review to validate the translation");
  if (version.version_number === 1 && version.translation_method !== "human")
    improvementTips.push("Generate a revised translation with additional context");
  if ((version.confidence_score ?? 0) < 0.7)
    improvementTips.push("A human translation or hybrid revision would improve confidence");

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
          </svg>
          Why this confidence score?
        </span>
        <svg className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3">
          <ul className="space-y-2">
            {factors.map((f, i) => {
              const icon = impactIcons[f.impact];
              return (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${icon.color} bg-current/10`}>
                    {icon.symbol}
                  </span>
                  <div>
                    <span className="font-medium text-gray-800">{f.label}</span>
                    <span className="text-gray-500"> — {f.detail}</span>
                  </div>
                </li>
              );
            })}
          </ul>

          {improvementTips.length > 0 && (
            <div className="mt-3 rounded-md bg-blue-50 p-3">
              <p className="mb-1 text-xs font-semibold text-blue-800">To improve this score:</p>
              <ul className="space-y-1">
                {improvementTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-blue-700">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-blue-400" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
