"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Manuscript } from "@/lib/types";
import { formatManuscriptDate } from "@/lib/utils/dates";
import { getLanguageName } from "@/lib/utils/languages";

interface ManuscriptListProps {
  manuscripts: Manuscript[];
}

export function ManuscriptList({ manuscripts }: ManuscriptListProps) {
  const [search, setSearch] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");

  const presentLanguages = useMemo(() => {
    const codes = new Set(manuscripts.map((m) => m.original_language));
    return Array.from(codes).sort();
  }, [manuscripts]);

  const filtered = useMemo(() => {
    return manuscripts.filter((m) => {
      if (
        search &&
        !m.title.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      if (languageFilter && m.original_language !== languageFilter) {
        return false;
      }
      return true;
    });
  }, [manuscripts, search, languageFilter]);

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search manuscripts by title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
        <select
          value={languageFilter}
          onChange={(e) => setLanguageFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          <option value="">All Languages</option>
          {presentLanguages.map((code) => (
            <option key={code} value={code}>
              {getLanguageName(code)}
            </option>
          ))}
        </select>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
          <svg
            className="mb-4 h-12 w-12 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
            />
          </svg>
          <p className="text-lg font-medium text-gray-500">
            No manuscripts found
          </p>
          <p className="mt-1 text-sm text-gray-400">
            {search || languageFilter
              ? "Try adjusting your filters."
              : "Add a manuscript to get started."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((manuscript) => (
            <ManuscriptCard key={manuscript.id} manuscript={manuscript} />
          ))}
        </div>
      )}
    </div>
  );
}

function ManuscriptCard({ manuscript }: { manuscript: Manuscript }) {
  const dateStr = formatManuscriptDate(
    manuscript.estimated_date_start,
    manuscript.estimated_date_end,
  );

  return (
    <Link
      href={`/manuscripts/${manuscript.id}`}
      className="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-primary-300 hover:shadow-md"
    >
      <h3 className="font-serif text-lg font-semibold text-primary-900 group-hover:text-primary-700">
        {manuscript.title}
      </h3>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700">
          {getLanguageName(manuscript.original_language)}
        </span>
        <span className="text-xs text-gray-500">{dateStr}</span>
      </div>

      {manuscript.archive_location && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-gray-600">
          <svg
            className="h-3.5 w-3.5 shrink-0 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0Z"
            />
          </svg>
          {manuscript.archive_location}
        </p>
      )}

      {manuscript.description && (
        <p className="mt-2 line-clamp-2 text-sm text-gray-500">
          {manuscript.description}
        </p>
      )}
    </Link>
  );
}
