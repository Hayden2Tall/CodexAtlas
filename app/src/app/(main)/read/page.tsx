import Link from "next/link";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BOOK_DISPLAY_NAMES,
  getTestamentSection,
  parseReference,
} from "@/lib/utils/book-order";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Scripture Browser — CodexAtlas",
  description:
    "Browse ancient manuscripts by book and chapter. Explore transparent AI translations with full evidence chains.",
};

interface BookEntry {
  displayName: string;
  order: number;
  section: "ot" | "nt" | "deuterocanonical" | "other";
  chapters: number[];
  manuscriptCount: number;
}

async function loadBooks(): Promise<BookEntry[]> {
  const admin = createAdminClient();

  const { data: passages } = await admin
    .from("passages")
    .select("reference, manuscript_id")
    .not("original_text", "is", null)
    .neq("original_text", "");

  const bookMap = new Map<
    number,
    { chapters: Set<number>; manuscripts: Set<string> }
  >();

  for (const p of passages ?? []) {
    const [order, chapter] = parseReference(p.reference);
    if (order === 999 || chapter === 0) continue;

    let entry = bookMap.get(order);
    if (!entry) {
      entry = { chapters: new Set(), manuscripts: new Set() };
      bookMap.set(order, entry);
    }
    entry.chapters.add(chapter);
    entry.manuscripts.add(p.manuscript_id);
  }

  const books: BookEntry[] = [];
  for (const [order, entry] of bookMap) {
    books.push({
      displayName: BOOK_DISPLAY_NAMES[order] ?? `Book ${order}`,
      order,
      section: getTestamentSection(order),
      chapters: [...entry.chapters].sort((a, b) => a - b),
      manuscriptCount: entry.manuscripts.size,
    });
  }

  return books.sort((a, b) => a.order - b.order);
}

const SECTION_LABELS: Record<string, string> = {
  ot: "Old Testament",
  nt: "New Testament",
  deuterocanonical: "Deuterocanonical",
  other: "Other Texts",
};

export default async function ReadPage() {
  const books = await loadBooks();
  const sections = ["ot", "nt", "deuterocanonical", "other"] as const;

  const hasContent = books.length > 0;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-gray-900">
          Scripture Browser
        </h1>
        <p className="mt-2 text-gray-600">
          Navigate by book and chapter across all manuscripts in the corpus.
        </p>
      </div>

      {!hasContent && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-8 py-16 text-center">
          <p className="text-gray-500">
            No passages have been imported yet. Use the{" "}
            <Link href="/admin" className="text-primary-700 underline">
              Admin panel
            </Link>{" "}
            to discover and import manuscripts.
          </p>
        </div>
      )}

      {hasContent && (
        <div className="space-y-10">
          {sections.map((sectionKey) => {
            const sectionBooks = books.filter((b) => b.section === sectionKey);
            if (sectionBooks.length === 0) return null;

            return (
              <section key={sectionKey}>
                <h2 className="mb-4 text-lg font-semibold text-gray-800">
                  {SECTION_LABELS[sectionKey]}
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {sectionBooks.map((book) => (
                    <BookCard key={book.order} book={book} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BookCard({ book }: { book: BookEntry }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-start justify-between">
        <h3 className="font-serif text-base font-semibold text-gray-900">
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
