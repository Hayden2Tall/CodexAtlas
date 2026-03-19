import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  BOOK_DISPLAY_NAMES,
  getTestamentSection,
  parseReference,
  extractBookName,
  SOURCE_TO_CATEGORY,
  type BrowserCategory,
} from "@/lib/utils/book-order";
import { BrowserClient } from "./browser-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manuscript Library — CodexAtlas",
  description:
    "Browse all manuscripts and ancient texts by book and chapter. Explore scripture, patristic works, and the Dead Sea Scrolls with full evidence chains.",
};

export interface BookEntry {
  displayName: string;
  order: number; // 999 for patristic/unknown
  section: BrowserCategory;
  chapters: number[];
  manuscriptCount: number;
}

async function loadBooks(): Promise<BookEntry[]> {
  const admin = createAdminClient();

  // Supabase PostgREST caps responses at 1000 rows by default.
  // Paginate to ensure every passage is counted regardless of corpus size.
  const PAGE_SIZE = 1000;
  const allPassages: { reference: string; manuscript_id: string }[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await admin
      .from("passages")
      .select("reference, manuscript_id")
      .not("original_text", "is", null)
      .neq("original_text", "")
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data?.length) break;
    allPassages.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  const passages = allPassages;

  // Pass 1: separate known books (in BOOK_ORDER) from unknown (patristic/other)
  const bookMap = new Map<
    number,
    { chapters: Set<number>; manuscripts: Set<string> }
  >();

  // key = raw title (for books not in BOOK_ORDER)
  const unknownMap = new Map<
    string,
    { chapters: Set<number>; manuscripts: Set<string> }
  >();
  const unknownManuscriptIds = new Set<string>();

  for (const p of passages ?? []) {
    const [order, chapter] = parseReference(p.reference);
    if (chapter === 0) continue;

    if (order !== 999) {
      // Known canonical book
      let entry = bookMap.get(order);
      if (!entry) {
        entry = { chapters: new Set(), manuscripts: new Set() };
        bookMap.set(order, entry);
      }
      entry.chapters.add(chapter);
      entry.manuscripts.add(p.manuscript_id);
    } else {
      // Unknown book — extract raw title
      const rawTitle = extractBookName(p.reference);
      if (!rawTitle) continue;
      let entry = unknownMap.get(rawTitle);
      if (!entry) {
        entry = { chapters: new Set(), manuscripts: new Set() };
        unknownMap.set(rawTitle, entry);
      }
      entry.chapters.add(chapter);
      entry.manuscripts.add(p.manuscript_id);
      unknownManuscriptIds.add(p.manuscript_id);
    }
  }

  // Pass 2: resolve source_registry_id for unknown books (batch query — avoids joining on every row)
  const manuscriptToSourceId = new Map<string, string>();
  if (unknownManuscriptIds.size > 0) {
    const { data: mss } = await admin
      .from("manuscripts")
      .select("id, metadata")
      .in("id", [...unknownManuscriptIds]);

    for (const ms of mss ?? []) {
      const srcId = (ms.metadata as Record<string, unknown> | null)
        ?.source_registry_id as string | undefined;
      if (srcId) manuscriptToSourceId.set(ms.id, srcId);
    }
  }

  // Build BookEntry list
  const books: BookEntry[] = [];

  // Known books
  for (const [order, entry] of bookMap) {
    books.push({
      displayName: BOOK_DISPLAY_NAMES[order] ?? `Book ${order}`,
      order,
      section: getTestamentSection(order),
      chapters: [...entry.chapters].sort((a, b) => a - b),
      manuscriptCount: entry.manuscripts.size,
    });
  }

  // Unknown books (patristic / other)
  for (const [rawTitle, entry] of unknownMap) {
    // Pick any manuscript_id to look up sourceId
    const anyMsId = [...entry.manuscripts][0];
    const sourceId = manuscriptToSourceId.get(anyMsId) ?? "";
    const category: BrowserCategory = SOURCE_TO_CATEGORY[sourceId] ?? "other";

    books.push({
      displayName: rawTitle,
      order: 999,
      section: category,
      chapters: [...entry.chapters].sort((a, b) => a - b),
      manuscriptCount: entry.manuscripts.size,
    });
  }

  return books.sort((a, b) => {
    // Known books first (by order), then unknown sorted alphabetically
    if (a.order !== b.order) {
      if (a.order === 999 && b.order !== 999) return 1;
      if (a.order !== 999 && b.order === 999) return -1;
      return a.order - b.order;
    }
    return a.displayName.localeCompare(b.displayName);
  });
}

export default async function ReadPage() {
  const admin = createAdminClient();

  const [books, { data: summaryRows }] = await Promise.all([
    loadBooks(),
    admin
      .from("ai_summaries")
      .select("scope_key")
      .eq("level", "book"),
  ]);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAuthenticated = !!user;

  const summarizedBooks = new Set((summaryRows ?? []).map((r) => r.scope_key));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-gray-900">
          Manuscript Library
        </h1>
        <p className="mt-2 text-gray-600">
          Browse scripture, patristic texts, and ancient manuscripts by book and chapter.
        </p>
      </div>

      <BrowserClient books={books} summarizedBooks={summarizedBooks} isAuthenticated={isAuthenticated} />
    </div>
  );
}
