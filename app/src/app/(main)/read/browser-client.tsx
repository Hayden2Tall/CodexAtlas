"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { BookEntry } from "./page";
import type { BrowserCategory } from "@/lib/utils/book-order";

interface Props {
  books: BookEntry[];
}

type Tab = "all" | BrowserCategory;

const TAB_ORDER: Tab[] = [
  "all",
  "ot",
  "nt",
  "deuterocanonical",
  "ethiopian",
  "patristic",
  "other",
];

const TAB_LABELS: Record<Tab, string> = {
  all: "All",
  ot: "Old Testament",
  nt: "New Testament",
  deuterocanonical: "Deuterocanonical",
  ethiopian: "Ethiopian Canon",
  patristic: "Early Church",
  other: "Other Texts",
};

export function BrowserClient({ books }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Count per category for tab badges
  const countByCategory = useMemo(() => {
    const counts: Partial<Record<Tab, number>> = { all: books.length };
    for (const b of books) {
      counts[b.section] = (counts[b.section] ?? 0) + 1;
    }
    return counts;
  }, [books]);

  // Only show tabs that have at least one book
  const visibleTabs = TAB_ORDER.filter(
    (t) => t === "all" || (countByCategory[t] ?? 0) > 0
  );

  const visible = useMemo(() => {
    let filtered =
      activeTab === "all"
        ? books
        : books.filter((b) => b.section === activeTab);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((b) =>
        b.displayName.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [books, activeTab, searchQuery]);

  const hasContent = books.length > 0;
  const showSearch = (countByCategory[activeTab] ?? books.length) > 20 || searchQuery.length > 0;

  if (!hasContent) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-8 py-16 text-center">
        <p className="text-gray-500">
          No passages have been imported yet. Use the{" "}
          <Link href="/admin" className="text-primary-700 underline">
            Admin panel
          </Link>{" "}
          to discover and import manuscripts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Category tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex flex-wrap gap-x-6 gap-y-1">
          {visibleTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setSearchQuery("");
              }}
              className={`border-b-2 pb-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "border-primary-700 text-primary-700"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {TAB_LABELS[tab]}
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${
                  activeTab === tab
                    ? "bg-primary-100 text-primary-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {tab === "all" ? books.length : (countByCategory[tab] ?? 0)}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Search */}
      {showSearch && (
        <div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${TAB_LABELS[activeTab].toLowerCase()}…`}
            className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      )}

      {/* Results summary when filtered */}
      {(searchQuery.trim() || activeTab !== "all") && (
        <p className="text-xs text-gray-400">
          Showing {visible.length} work{visible.length !== 1 ? "s" : ""}
          {searchQuery.trim() ? ` matching "${searchQuery}"` : ""}
        </p>
      )}

      {/* Book grid */}
      {visible.length === 0 ? (
        <div className="py-12 text-center text-gray-500 text-sm">
          No works found{searchQuery ? ` matching "${searchQuery}"` : ""}.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((book) => (
            <BookCard key={`${book.order}-${book.displayName}`} book={book} />
          ))}
        </div>
      )}
    </div>
  );
}

function BookCard({ book }: { book: BookEntry }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-start justify-between">
        <h3 className="font-serif text-base font-semibold text-gray-900 leading-snug">
          {book.displayName}
        </h3>
        <span className="ml-2 shrink-0 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
          {book.manuscriptCount} ms{book.manuscriptCount !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {book.chapters.map((ch) => (
          <Link
            key={ch}
            href={`/read/${encodeURIComponent(book.displayName)}/${ch}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 text-sm font-medium text-gray-700 transition-colors hover:bg-primary-50 hover:text-primary-700"
          >
            {ch}
          </Link>
        ))}
      </div>
    </div>
  );
}
