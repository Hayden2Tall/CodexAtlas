"use client";

import { useRouter } from "next/navigation";

interface ChapterNavProps {
  book: string;
  currentChapter: number;
  chapters: number[];
}

export function ChapterNav({ book, currentChapter, chapters }: ChapterNavProps) {
  const router = useRouter();

  return (
    <select
      value={currentChapter}
      onChange={(e) => {
        router.push(`/read/${encodeURIComponent(book)}/${e.target.value}`);
      }}
      className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      aria-label="Select chapter"
    >
      {chapters.map((ch) => (
        <option key={ch} value={ch}>
          Chapter {ch}
        </option>
      ))}
    </select>
  );
}
