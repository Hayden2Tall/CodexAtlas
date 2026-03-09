"use client";

import { useState } from "react";
import { computeWordDiff, type DiffSegment } from "@/lib/utils/diff";
import type { Variant, VariantReading } from "@/lib/types";
import { EmptyState } from "@/components/ui/empty-state";

interface ReadingWithManuscript extends VariantReading {
  manuscripts: {
    id: string;
    title: string;
    original_language: string;
  } | null;
}

interface VariantComparisonViewProps {
  variant: Variant;
  readings: ReadingWithManuscript[];
}

const diffClasses: Record<DiffSegment["type"], string> = {
  same: "",
  added: "bg-green-100 text-green-800",
  removed: "bg-red-100 text-red-800 line-through",
  changed: "bg-yellow-100 text-yellow-800",
};

function DiffText({ segments }: { segments: DiffSegment[] }) {
  return (
    <p className="font-mono text-sm leading-relaxed">
      {segments.map((seg, i) => (
        <span key={i} className={diffClasses[seg.type]}>
          {seg.text}{" "}
        </span>
      ))}
    </p>
  );
}

function TwoColumnLayout({
  readings,
}: {
  readings: ReadingWithManuscript[];
}) {
  const [a, b] = readings;
  const { segmentsA, segmentsB } = computeWordDiff(
    a.reading_text,
    b.reading_text
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel reading={a}>
        <DiffText segments={segmentsA} />
      </Panel>
      <Panel reading={b}>
        <DiffText segments={segmentsB} />
      </Panel>
    </div>
  );
}

function MultiColumnLayout({
  readings,
  activeTab,
  onTabChange,
}: {
  readings: ReadingWithManuscript[];
  activeTab: number;
  onTabChange: (i: number) => void;
}) {
  const base = readings[0];

  return (
    <div>
      {/* Tabs for mobile */}
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1 md:hidden">
        {readings.map((r, i) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onTabChange(i)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              i === activeTab
                ? "bg-white text-primary-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {r.manuscripts?.title ?? "Unknown"}
          </button>
        ))}
      </div>

      {/* Tab content (mobile) */}
      <div className="md:hidden">
        <Panel reading={readings[activeTab]}>
          {activeTab === 0 ? (
            <p className="font-mono text-sm leading-relaxed">
              {readings[activeTab].reading_text}
            </p>
          ) : (
            <DiffText
              segments={
                computeWordDiff(
                  base.reading_text,
                  readings[activeTab].reading_text
                ).segmentsB
              }
            />
          )}
        </Panel>
      </div>

      {/* Scrollable panels (desktop) */}
      <div className="hidden gap-4 overflow-x-auto md:flex">
        {readings.map((reading, i) => {
          const diffResult =
            i === 0
              ? null
              : computeWordDiff(base.reading_text, reading.reading_text);

          return (
            <div key={reading.id} className="min-w-[280px] flex-1">
              <Panel reading={reading}>
                {i === 0 ? (
                  <p className="font-mono text-sm leading-relaxed">
                    {reading.reading_text}
                  </p>
                ) : (
                  <DiffText segments={diffResult!.segmentsB} />
                )}
              </Panel>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Panel({
  reading,
  children,
}: {
  reading: ReadingWithManuscript;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">
          {reading.manuscripts?.title ?? "Unknown manuscript"}
        </h3>
        <p className="text-xs text-gray-500">
          {reading.manuscripts?.original_language}
        </p>
      </div>
      <div className="p-4">{children}</div>
      {reading.apparatus_notes && (
        <div className="border-t border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-500">
            <span className="font-medium">Apparatus:</span>{" "}
            {reading.apparatus_notes}
          </p>
        </div>
      )}
    </div>
  );
}

export function VariantComparisonView({
  variant,
  readings,
}: VariantComparisonViewProps) {
  const [activeTab, setActiveTab] = useState(0);

  if (readings.length === 0) {
    return (
      <EmptyState
        title="No readings yet"
        description="Add manuscript readings to begin comparing textual variants."
        action={{
          label: "Add Reading",
          href: `/variants/${variant.id}/readings/new`,
        }}
      />
    );
  }

  if (readings.length === 1) {
    return (
      <div>
        <div className="mb-3 flex items-center gap-2 text-sm text-gray-500">
          <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
          Only one reading — add another to compare
        </div>
        <Panel reading={readings[0]}>
          <p className="font-mono text-sm leading-relaxed">
            {readings[0].reading_text}
          </p>
        </Panel>
      </div>
    );
  }

  if (readings.length === 2) {
    return <TwoColumnLayout readings={readings} />;
  }

  return (
    <MultiColumnLayout
      readings={readings}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    />
  );
}
