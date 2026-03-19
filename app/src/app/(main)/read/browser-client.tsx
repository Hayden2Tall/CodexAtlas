"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { BookEntry } from "./page";
import type { BrowserCategory } from "@/lib/utils/book-order";

const COST_PER_BOOK = 0.015; // Sonnet 4.6 estimate for book summary (~2k in + 500 out tokens)
const DELAY_BETWEEN_MS = 1200;

interface Props {
  books: BookEntry[];
  summarizedBooks: Set<string>;
  isAuthenticated: boolean;
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

export function BrowserClient({ books, summarizedBooks, isAuthenticated }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const countByCategory = useMemo(() => {
    const counts: Partial<Record<Tab, number>> = { all: books.length };
    for (const b of books) {
      counts[b.section] = (counts[b.section] ?? 0) + 1;
    }
    return counts;
  }, [books]);

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

  const unsummarizedVisible = visible.filter((b) => !summarizedBooks.has(b.displayName));

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

      {/* Search + bulk summarize row */}
      <div className="flex flex-wrap items-center gap-3">
        {showSearch && (
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${TAB_LABELS[activeTab].toLowerCase()}…`}
            className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        )}
        {isAuthenticated && unsummarizedVisible.length > 0 && (
          <BulkBookSummaryTrigger books={unsummarizedVisible.map((b) => b.displayName)} />
        )}
      </div>

      {/* Results summary when filtered */}
      {(searchQuery.trim() || activeTab !== "all") && (
        <p className="text-xs text-gray-400">
          Showing {visible.length} work{visible.length !== 1 ? "s" : ""}
          {searchQuery.trim() ? ` matching "${searchQuery}"` : ""}
          {summarizedBooks.size > 0 && (
            <> · {visible.filter((b) => summarizedBooks.has(b.displayName)).length} summarized</>
          )}
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
            <BookCard
              key={`${book.order}-${book.displayName}`}
              book={book}
              isSummarized={summarizedBooks.has(book.displayName)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BookCard({ book, isSummarized }: { book: BookEntry; isSummarized: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-start justify-between">
        <Link
          href={`/read/${encodeURIComponent(book.displayName)}`}
          className="font-serif text-base font-semibold text-gray-900 leading-snug hover:text-primary-700"
        >
          {book.displayName}
        </Link>
        <div className="ml-2 flex shrink-0 items-center gap-1.5">
          {isSummarized && (
            <span title="Book summary available" className="h-2 w-2 rounded-full bg-blue-400" />
          )}
          <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
            {book.manuscriptCount} ms{book.manuscriptCount !== 1 ? "s" : ""}
          </span>
        </div>
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

type BulkPhase = "idle" | "confirming" | "running" | "done";

function BulkBookSummaryTrigger({ books }: { books: string[] }) {
  const [phase, setPhase] = useState<BulkPhase>("idle");
  const [progress, setProgress] = useState({ done: 0, skipped: 0, failed: 0, total: 0 });
  const [currentBook, setCurrentBook] = useState("");

  const estimatedCost = books.length * COST_PER_BOOK;

  async function start() {
    setPhase("running");
    setProgress({ done: 0, skipped: 0, failed: 0, total: books.length });

    let done = 0, skipped = 0, failed = 0;

    for (let i = 0; i < books.length; i++) {
      const book = books[i];
      setCurrentBook(book);

      try {
        const res = await fetch("/api/summaries/book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ book }),
        });

        if (res.status === 422) {
          // No chapter summaries yet — skip gracefully
          skipped++;
        } else if (res.ok) {
          done++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }

      setProgress({ done, skipped, failed, total: books.length });

      if (i < books.length - 1) {
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_MS));
      }
    }

    setCurrentBook("");
    setPhase("done");
  }

  if (phase === "confirming") {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
        <p className="font-medium text-blue-900">
          Generate summaries for {books.length} unsummarized book{books.length !== 1 ? "s" : ""}?
        </p>
        <p className="mt-0.5 text-xs text-blue-700">
          Estimated cost: ~${estimatedCost.toFixed(2)} (Sonnet 4.6). Books without chapter summaries will be skipped — generate chapter summaries first from each book page.
        </p>
        <div className="mt-2 flex gap-2">
          <button
            onClick={start}
            className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800"
          >
            Confirm &amp; Generate
          </button>
          <button
            onClick={() => setPhase("idle")}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (phase === "running") {
    const processed = progress.done + progress.skipped + progress.failed;
    const pct = progress.total > 0 ? Math.round((processed / progress.total) * 100) : 0;
    return (
      <div className="min-w-[240px] space-y-1.5">
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-gray-500">
          {processed}/{progress.total}
          {progress.skipped > 0 && <span className="ml-1 text-amber-600">· {progress.skipped} skipped</span>}
          {progress.failed > 0 && <span className="ml-1 text-red-500">· {progress.failed} failed</span>}
          {currentBook && <span className="ml-1 text-gray-400">— {currentBook}</span>}
        </p>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <p className="text-xs text-blue-700">
        {progress.done} book{progress.done !== 1 ? "s" : ""} summarized
        {progress.skipped > 0 && <span className="text-amber-600"> · {progress.skipped} skipped (no chapter summaries)</span>}
        {progress.failed > 0 && <span className="text-red-500"> · {progress.failed} failed</span>}
      </p>
    );
  }

  return (
    <button
      onClick={() => setPhase("confirming")}
      className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
    >
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
      </svg>
      Summarize {books.length} book{books.length !== 1 ? "s" : ""} — ~${estimatedCost.toFixed(2)}
    </button>
  );
}
