"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { Manuscript, Passage, ManuscriptImage } from "@/lib/types";
import { formatManuscriptDate } from "@/lib/utils/dates";
import { getLanguageName } from "@/lib/utils/languages";
import { ManuscriptSummary } from "@/components/ui/manuscript-summary";

type Tab = "overview" | "passages" | "images";

interface ManuscriptDetailProps {
  manuscript: Manuscript;
  passages: Passage[];
  images: ManuscriptImage[];
  isAuthenticated: boolean;
}

export function ManuscriptDetail({
  manuscript,
  passages,
  images,
  isAuthenticated,
}: ManuscriptDetailProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [expandedPassage, setExpandedPassage] = useState<string | null>(null);

  const dateStr = formatManuscriptDate(
    manuscript.estimated_date_start,
    manuscript.estimated_date_end,
  );

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "passages", label: "Passages", count: passages.length },
    { key: "images", label: "Images", count: images.length },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-gray-500">
        <Link href="/manuscripts" className="hover:text-primary-700">
          Manuscripts
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{manuscript.title}</span>
      </nav>

      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary-900">
            {manuscript.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700">
              {getLanguageName(manuscript.original_language)}
            </span>
            <span className="text-sm text-gray-500">{dateStr}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu manuscriptId={manuscript.id} />
          {isAuthenticated && (
            <Link
              href={`/manuscripts/${manuscript.id}/passages/new`}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-800"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              Add Passage
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-6" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-primary-700 text-primary-700"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {tab.label}
              {tab.count != null && (
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                    activeTab === tab.key
                      ? "bg-primary-50 text-primary-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <OverviewTab manuscript={manuscript} isAuthenticated={isAuthenticated} />
      )}
      {activeTab === "passages" && (
        <PassagesTab
          passages={passages}
          manuscriptId={manuscript.id}
          expandedPassage={expandedPassage}
          onToggle={(id) =>
            setExpandedPassage(expandedPassage === id ? null : id)
          }
          isAuthenticated={isAuthenticated}
        />
      )}
      {activeTab === "images" && <ImagesTab images={images} />}
    </div>
  );
}

function OverviewTab({ manuscript, isAuthenticated }: { manuscript: Manuscript; isAuthenticated: boolean }) {
  const meta = (manuscript.metadata as Record<string, unknown>) ?? {};
  const cachedSummary = meta.ai_summary
    ? (meta.ai_summary as { summary: string; significance_factors: string[]; historical_period: string; related_traditions: string })
    : null;

  const fields: { label: string; value: string | null }[] = [
    {
      label: "Date Range",
      value: formatManuscriptDate(
        manuscript.estimated_date_start,
        manuscript.estimated_date_end,
      ),
    },
    {
      label: "Original Language",
      value: getLanguageName(manuscript.original_language),
    },
    { label: "Origin", value: manuscript.origin_location },
    { label: "Archive", value: manuscript.archive_location },
    { label: "Archive Identifier", value: manuscript.archive_identifier },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        {manuscript.description && (
          <section>
            <h2 className="mb-2 font-serif text-lg font-semibold text-gray-900">
              Description
            </h2>
            <p className="leading-relaxed text-gray-700 whitespace-pre-line">
              {manuscript.description}
            </p>
          </section>
        )}
        {manuscript.historical_context && (
          <section>
            <h2 className="mb-2 font-serif text-lg font-semibold text-gray-900">
              Historical Context
            </h2>
            <p className="leading-relaxed text-gray-700 whitespace-pre-line">
              {manuscript.historical_context}
            </p>
          </section>
        )}

        <ManuscriptSummary
          manuscriptId={manuscript.id}
          cachedSummary={cachedSummary}
          isAuthenticated={isAuthenticated}
        />
      </div>

      {/* Sidebar metadata */}
      <aside className="rounded-xl border border-gray-200 bg-gray-50 p-5">
        <h2 className="mb-4 font-serif text-base font-semibold text-gray-900">
          Provenance
        </h2>
        <dl className="space-y-3">
          {fields.map(
            (field) =>
              field.value && (
                <div key={field.label}>
                  <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    {field.label}
                  </dt>
                  <dd className="mt-0.5 text-sm text-gray-900">
                    {field.value}
                  </dd>
                </div>
              ),
          )}
        </dl>
      </aside>
    </div>
  );
}

function PassagesTab({
  passages: initialPassages,
  manuscriptId,
  expandedPassage,
  onToggle,
  isAuthenticated,
}: {
  passages: Passage[];
  manuscriptId: string;
  expandedPassage: string | null;
  onToggle: (id: string) => void;
  isAuthenticated: boolean;
}) {
  const [passages, setPassages] = useState(initialPassages);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editRef, setEditRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  function startEdit(passage: Passage) {
    setEditingId(passage.id);
    setEditText(passage.original_text ?? "");
    setEditRef(passage.reference);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText("");
    setEditRef("");
  }

  async function saveEdit(passageId: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/passages/${passageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original_text: editText,
          reference: editRef,
        }),
      });
      if (res.ok) {
        const { passage: updated } = await res.json();
        setPassages((prev) =>
          prev.map((p) => (p.id === passageId ? { ...p, ...updated } : p))
        );
        cancelEdit();
      }
    } finally {
      setSaving(false);
    }
  }

  async function deletePassage(passageId: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/passages/${passageId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPassages((prev) => prev.filter((p) => p.id !== passageId));
        setDeleteConfirm(null);
      }
    } finally {
      setSaving(false);
    }
  }

  if (passages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
        <p className="text-lg font-medium text-gray-500">
          No passages recorded yet
        </p>
        {isAuthenticated && (
          <Link
            href={`/manuscripts/${manuscriptId}/passages/new`}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800"
          >
            Add the first passage
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {passages.map((passage) => {
        const isExpanded = expandedPassage === passage.id;
        const isEditing = editingId === passage.id;
        return (
          <div
            key={passage.id}
            className="rounded-lg border border-gray-200 bg-white"
          >
            <button
              onClick={() => onToggle(passage.id)}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <div className="flex items-center gap-3">
                {passage.sequence_order != null && (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700">
                    {passage.sequence_order}
                  </span>
                )}
                <span className="font-medium text-gray-900">
                  {passage.reference}
                </span>
                {passage.transcription_method && (
                  <TranscriptionBadge
                    method={passage.transcription_method}
                    metadata={passage.metadata as Record<string, unknown> | null}
                  />
                )}
                {!passage.original_text && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600">
                    No text
                  </span>
                )}
              </div>
              <svg
                className={`h-5 w-5 text-gray-400 transition-transform ${
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
                  d="m19.5 8.25-7.5 7.5-7.5-7.5"
                />
              </svg>
            </button>
            {isExpanded && (
              <div className="border-t border-gray-100 px-5 py-4">
                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Reference
                      </label>
                      <input
                        type="text"
                        value={editRef}
                        onChange={(e) => setEditRef(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Original Text
                      </label>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={10}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm leading-relaxed focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                        placeholder="Paste or type the original-language text here..."
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(passage.id)}
                        disabled={saving}
                        className="rounded-md bg-primary-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-800 disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {passage.original_text ? (
                      <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-gray-800">
                        {passage.original_text}
                      </pre>
                    ) : (
                      <p className="text-sm italic text-gray-400">
                        No original text transcribed yet.
                        {isAuthenticated && " Click Edit to add text."}
                      </p>
                    )}
                    <div className="mt-4 flex items-center gap-2">
                      <Link
                        href={`/manuscripts/${manuscriptId}/passages/${passage.id}/translate`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-primary-300 bg-white px-3 py-1.5 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-50"
                      >
                        View Translation
                      </Link>
                      {isAuthenticated && (
                        <>
                          <button
                            onClick={() => startEdit(passage)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                          >
                            Edit
                          </button>
                          {deleteConfirm === passage.id ? (
                            <span className="flex items-center gap-1.5">
                              <span className="text-xs text-red-600">Delete?</span>
                              <button
                                onClick={() => deletePassage(passage.id)}
                                disabled={saving}
                                className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                              >
                                No
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(passage.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                            >
                              Delete
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TranscriptionBadge({
  method,
  metadata,
}: {
  method: string;
  metadata: Record<string, unknown> | null;
}) {
  if (method === "scholarly_transcription") {
    const source = String(metadata?.transcription_source ?? "INTF");
    const ga = metadata?.ga_number ? ` (GA ${String(metadata.ga_number)})` : "";
    return (
      <span
        className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700"
        title={`Manuscript-specific scholarly transcription from ${source}${ga} — reflects this manuscript's actual readings`}
      >
        {source} Transcription{ga}
      </span>
    );
  }

  if (method === "standard_edition") {
    const edition = String(metadata?.edition_source ?? "");
    return (
      <span
        className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600"
        title={`Standard edition text${edition ? ` (${edition})` : ""} — not a manuscript-specific transcription`}
      >
        Std. Edition{edition ? ` (${edition})` : ""}
      </span>
    );
  }

  return (
    <span
      className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
      title={method}
    >
      {method}
    </span>
  );
}

function ImagesTab({ images }: { images: ManuscriptImage[] }) {
  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
        <p className="text-lg font-medium text-gray-500">
          No images uploaded yet
        </p>
        <p className="mt-1 text-sm text-gray-400">
          Manuscript images will appear here once uploaded.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {images.map((image) => (
        <div
          key={image.id}
          className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
        >
          <div className="flex h-48 items-center justify-center bg-gray-100 text-sm text-gray-400">
            {image.storage_path}
          </div>
          <div className="px-4 py-3">
            {image.page_number != null && (
              <p className="text-sm font-medium text-gray-900">
                Page {image.page_number}
              </p>
            )}
            {image.image_type && (
              <p className="text-xs text-gray-500">{image.image_type}</p>
            )}
            {image.ocr_status && (
              <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                OCR: {image.ocr_status}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ExportMenu({ manuscriptId }: { manuscriptId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const formats = [
    { key: "json", label: "JSON", desc: "Full structured data" },
    { key: "csv", label: "CSV", desc: "Spreadsheet-compatible" },
    { key: "tei", label: "TEI XML", desc: "Scholarly standard" },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
          />
        </svg>
        Export
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {formats.map((f) => (
            <a
              key={f.key}
              href={`/api/export/${manuscriptId}?format=${f.key}`}
              onClick={() => setOpen(false)}
              className="flex flex-col px-4 py-2 hover:bg-gray-50"
            >
              <span className="text-sm font-medium text-gray-900">
                {f.label}
              </span>
              <span className="text-xs text-gray-500">{f.desc}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
