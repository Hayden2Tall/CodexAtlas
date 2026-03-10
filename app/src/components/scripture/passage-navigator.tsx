"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";

interface BookInfo {
  book: string;
  displayName: string;
  chapters: number[];
}

interface PassageNavigatorProps {
  books: BookInfo[];
  currentBook?: string;
  currentChapter?: number;
}

export function PassageNavigator({
  books,
  currentBook,
  currentChapter,
}: PassageNavigatorProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const selectedBook = books.find(
    (b) => b.displayName.toLowerCase() === currentBook?.toLowerCase()
  );

  const currentLabel = currentBook && currentChapter
    ? `${currentBook} ${currentChapter}`
    : "Select a passage";

  const navigate = useCallback(
    (book: string, chapter: number) => {
      router.push(`/read/${encodeURIComponent(book)}/${chapter}`);
      setMobileOpen(false);
    },
    [router]
  );

  useEffect(() => {
    if (!mobileOpen) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [mobileOpen]);

  return (
    <>
      {/* Desktop: two linked selects */}
      <div className="hidden items-center gap-3 md:flex">
        <select
          value={currentBook ?? ""}
          onChange={(e) => {
            const book = books.find((b) => b.displayName === e.target.value);
            if (book && book.chapters.length > 0) {
              navigate(book.displayName, book.chapters[0]);
            }
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          aria-label="Select book"
        >
          <option value="" disabled>
            Book
          </option>
          {books.map((b) => (
            <option key={b.book} value={b.displayName}>
              {b.displayName}
            </option>
          ))}
        </select>

        <select
          value={currentChapter ?? ""}
          onChange={(e) => {
            if (currentBook) {
              navigate(currentBook, parseInt(e.target.value, 10));
            }
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          aria-label="Select chapter"
          disabled={!selectedBook}
        >
          <option value="" disabled>
            Ch
          </option>
          {(selectedBook?.chapters ?? []).map((ch) => (
            <option key={ch} value={ch}>
              {ch}
            </option>
          ))}
        </select>
      </div>

      {/* Mobile: single button that opens bottom sheet */}
      <button
        onClick={() => setMobileOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm md:hidden"
        aria-label="Navigate to passage"
      >
        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
        {currentLabel}
        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Mobile bottom sheet */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div
            ref={panelRef}
            className="relative w-full max-h-[75vh] overflow-hidden rounded-t-2xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Navigate
              </h3>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto p-4" style={{ maxHeight: "calc(75vh - 52px)" }}>
              {books.map((b) => (
                <div key={b.book} className="mb-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {b.displayName}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {b.chapters.map((ch) => {
                      const isActive =
                        b.displayName.toLowerCase() === currentBook?.toLowerCase() &&
                        ch === currentChapter;
                      return (
                        <button
                          key={ch}
                          onClick={() => navigate(b.displayName, ch)}
                          className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                            isActive
                              ? "bg-primary-700 text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-primary-50 hover:text-primary-700"
                          }`}
                        >
                          {ch}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
