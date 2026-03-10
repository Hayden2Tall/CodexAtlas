"use client";

import Link from "next/link";
import { getLanguageName } from "@/lib/utils/languages";
import type { EvidenceRecord, TranslationVersion, Review, Manuscript } from "@/lib/types";

interface Props {
  evidence: EvidenceRecord;
  translationVersion: TranslationVersion | null;
  reviews: Review[];
  sourceManuscripts: Pick<Manuscript, "id" | "title" | "original_language">[];
}

export function EvidenceExplorer({
  evidence,
  translationVersion,
  reviews,
  sourceManuscripts,
}: Props) {
  const metadata = evidence.metadata as Record<string, unknown> | null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <nav className="mb-6 text-sm text-gray-500">
        <Link href="/manuscripts" className="hover:text-primary-700">
          Manuscripts
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">Evidence Chain</span>
      </nav>

      <h1 className="font-serif text-2xl font-bold text-primary-900">
        Evidence Explorer
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Full provenance and evidence chain for this entity.
      </p>

      {/* Evidence chain visualization */}
      <div className="mt-8 space-y-6">
        {/* Source manuscripts */}
        <ChainSection
          title="Source Manuscripts"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
          }
        >
          {sourceManuscripts.length > 0 ? (
            <div className="space-y-2">
              {sourceManuscripts.map((m) => (
                <Link
                  key={m.id}
                  href={`/manuscripts/${m.id}`}
                  className="flex items-center gap-3 rounded-md border border-gray-100 bg-gray-50 p-3 hover:border-primary-200 hover:bg-primary-50/30 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-900">
                    {m.title}
                  </span>
                  <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700">
                    {getLanguageName(m.original_language)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No source manuscripts linked.</p>
          )}
        </ChainSection>

        {/* AI Processing */}
        <ChainSection
          title="AI Processing"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
            </svg>
          }
        >
          <div className="rounded-md border border-gray-100 bg-gray-50 p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-medium text-gray-500">Method</p>
                <p className="text-gray-900">
                  {evidence.translation_method ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Model</p>
                <p className="font-mono text-xs text-gray-900">
                  {evidence.ai_model ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">
                  Confidence
                </p>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-primary-600"
                      style={{
                        width: `${(evidence.confidence_score ?? 0) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-gray-900">
                    {evidence.confidence_score
                      ? `${Math.round(evidence.confidence_score * 100)}%`
                      : "—"}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">
                  Entity Type
                </p>
                <p className="text-gray-900">{evidence.entity_type}</p>
              </div>
            </div>

            {metadata && (
              <div className="mt-4 border-t border-gray-200 pt-3">
                {typeof metadata.translation_notes === "string" && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-gray-500">
                      Translation Notes
                    </p>
                    <p className="mt-0.5 text-xs text-gray-700">
                      {metadata.translation_notes as string}
                    </p>
                  </div>
                )}
                {Array.isArray(metadata.key_decisions) && (
                  <div>
                    <p className="text-xs font-medium text-gray-500">
                      Key Decisions
                    </p>
                    <ul className="mt-1 space-y-1">
                      {(metadata.key_decisions as string[]).map((d, i) => (
                        <li
                          key={i}
                          className="text-xs text-gray-700 before:mr-1.5 before:text-gray-400 before:content-['\2022']"
                        >
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </ChainSection>

        {/* Translation output */}
        {translationVersion && (
          <ChainSection
            title="Translation Output"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m10.5 21 5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 0 1-3.827-5.802" />
              </svg>
            }
          >
            <div className="rounded-md border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Version {translationVersion.version_number}</span>
                <span className={`rounded-full px-2 py-0.5 font-medium ${
                  translationVersion.status === "published"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}>
                  {translationVersion.status}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                {translationVersion.translated_text}
              </p>
            </div>
          </ChainSection>
        )}

        {/* Reviews */}
        <ChainSection
          title={`Human Reviews (${reviews.length})`}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
            </svg>
          }
        >
          {reviews.length > 0 ? (
            <div className="space-y-2">
              {reviews.map((r) => (
                <div
                  key={r.id}
                  className="rounded-md border border-gray-100 bg-gray-50 p-3"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          className={`h-3.5 w-3.5 ${
                            star <= r.rating
                              ? "text-amber-400"
                              : "text-gray-300"
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.status === "submitted"
                        ? "bg-blue-100 text-blue-700"
                        : r.status === "incorporated"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                    }`}>
                      {r.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-gray-700">{r.critique}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No reviews yet.</p>
          )}
        </ChainSection>
      </div>

      {/* Metadata footer */}
      <div className="mt-8 rounded-md border border-gray-200 bg-gray-50 p-4">
        <p className="text-xs font-medium text-gray-500">Record Details</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
          <div>
            <span className="text-gray-400">Evidence ID: </span>
            <span className="font-mono">{evidence.id.slice(0, 8)}...</span>
          </div>
          <div>
            <span className="text-gray-400">Created: </span>
            {new Date(evidence.created_at).toLocaleString()}
          </div>
          <div>
            <span className="text-gray-400">Entity ID: </span>
            <span className="font-mono">{evidence.entity_id.slice(0, 8)}...</span>
          </div>
          {evidence.revision_reason && (
            <div>
              <span className="text-gray-400">Revision: </span>
              {evidence.revision_reason}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChainSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative pl-8">
      {/* Connector line */}
      <div className="absolute left-3 top-0 h-full w-px bg-gray-200" />

      {/* Icon */}
      <div className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-white text-primary-600 ring-2 ring-gray-200">
        {icon}
      </div>

      <div className="pb-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">{title}</h2>
        {children}
      </div>
    </div>
  );
}
