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
    estimated_date_start?: number | null;
    estimated_date_end?: number | null;
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

function formatDateRange(start?: number | null, end?: number | null): string {
  if (!start && !end) return "";
  const suffix = (y: number) => (y < 0 ? `${Math.abs(y)} BCE` : `${y} CE`);
  if (start && end && start !== end) return `${suffix(start)}–${suffix(end)}`;
  return suffix(start ?? end!);
}

function AttestationSection({ readings }: { readings: ReadingWithManuscript[] }) {
  const normalizedGroups = new Map<string, ReadingWithManuscript[]>();
  for (const r of readings) {
    const key = r.reading_text.replace(/\s+/g, " ").trim();
    const group = normalizedGroups.get(key);
    if (group) group.push(r);
    else normalizedGroups.set(key, [r]);
  }

  const groups = [...normalizedGroups.entries()]
    .map(([text, members]) => ({ text, members, count: members.length }))
    .sort((a, b) => b.count - a.count);

  const majorityCount = groups[0]?.count ?? 0;

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">
        Attestation Summary
      </h3>
      <div className="space-y-4">
        {groups.map((group, gi) => {
          const isMajority = group.count === majorityCount && groups.length > 1;
          return (
            <div key={gi} className={`rounded-lg border p-3 ${isMajority ? "border-primary-200 bg-primary-50/40" : "border-gray-100 bg-gray-50/40"}`}>
              <div className="mb-2 flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${isMajority ? "bg-primary-100 text-primary-700" : "bg-gray-200 text-gray-600"}`}>
                  {isMajority ? "Majority" : "Minority"} &middot; {group.count} ms{group.count !== 1 ? "s" : ""}
                </span>
              </div>
              <p className="mb-2 font-mono text-xs leading-relaxed text-gray-700">
                &ldquo;{group.text.length > 200 ? group.text.slice(0, 200) + "…" : group.text}&rdquo;
              </p>
              <ul className="space-y-1">
                {group.members.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="h-1 w-1 shrink-0 rounded-full bg-gray-400" />
                    <span className="font-medium text-gray-800">
                      {m.manuscripts?.title ?? "Unknown"}
                    </span>
                    {m.manuscripts && (
                      <span className="text-gray-400">
                        {formatDateRange(m.manuscripts.estimated_date_start, m.manuscripts.estimated_date_end)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
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

  return (
    <>
      {readings.length === 2 ? (
        <TwoColumnLayout readings={readings} />
      ) : (
        <MultiColumnLayout
          readings={readings}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      )}
      <AttestationSection readings={readings} />
    </>
  );
}
