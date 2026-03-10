import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BOOK_DISPLAY_NAMES,
  getTestamentSection,
  parseReference,
} from "@/lib/utils/book-order";

export const revalidate = 300;

interface BookEntry {
  book: string;
  displayName: string;
  order: number;
  section: "ot" | "nt" | "deuterocanonical" | "other";
  chapters: number[];
  manuscriptCount: number;
  passageCount: number;
}

export async function GET() {
  try {
    const admin = createAdminClient();

    const { data: passages, error } = await admin
      .from("passages")
      .select("reference, manuscript_id")
      .not("original_text", "is", null)
      .neq("original_text", "");

    if (error) {
      console.error("[scripture/books] query error:", error.message);
      return NextResponse.json({ error: "Failed to load books" }, { status: 500 });
    }

    const bookMap = new Map<
      number,
      { bookKey: string; chapters: Set<number>; manuscripts: Set<string>; passageCount: number }
    >();

    for (const p of passages ?? []) {
      const [order, chapter] = parseReference(p.reference);
      if (order === 999 || chapter === 0) continue;

      let entry = bookMap.get(order);
      if (!entry) {
        const match = p.reference.match(/^(.+?)\s+\d+/);
        entry = {
          bookKey: match ? match[1].trim().toLowerCase() : p.reference.toLowerCase(),
          chapters: new Set(),
          manuscripts: new Set(),
          passageCount: 0,
        };
        bookMap.set(order, entry);
      }
      entry.chapters.add(chapter);
      entry.manuscripts.add(p.manuscript_id);
      entry.passageCount++;
    }

    const books: BookEntry[] = [];
    for (const [order, entry] of bookMap) {
      books.push({
        book: entry.bookKey,
        displayName: BOOK_DISPLAY_NAMES[order] ?? entry.bookKey,
        order,
        section: getTestamentSection(order),
        chapters: [...entry.chapters].sort((a, b) => a - b),
        manuscriptCount: entry.manuscripts.size,
        passageCount: entry.passageCount,
      });
    }

    books.sort((a, b) => a.order - b.order);

    return NextResponse.json({ books });
  } catch (err) {
    console.error("[scripture/books] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
