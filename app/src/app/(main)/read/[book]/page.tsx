import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { BOOK_ORDER, parseReference } from "@/lib/utils/book-order";
import { BookSummaryPanel } from "./book-summary-panel";
import { BookAdminPanel } from "./book-admin-panel";

interface PageProps {
  params: Promise<{ book: string }>;
}

interface BookSummaryContent {
  overview: string;
  structure: string;
  theological_themes: string[];
  manuscript_tradition: string;
  scholarly_significance: string;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { book } = await params;
  const bookDecoded = decodeURIComponent(book);
  return {
    title: `${bookDecoded} — CodexAtlas`,
    description: `Manuscripts, chapters, and AI-synthesized summary for the book of ${bookDecoded}.`,
  };
}

export default async function BookOverviewPage({ params }: PageProps) {
  const { book } = await params;
  const bookDecoded = decodeURIComponent(book);

  const admin = createAdminClient();

  // Determine all aliases for this book (handles "Psalm"/"Psalms" etc.)
  const targetOrder = BOOK_ORDER[bookDecoded.toLowerCase()] ?? 999;
  const aliases =
    targetOrder !== 999
      ? [...new Set(Object.entries(BOOK_ORDER).filter(([, v]) => v === targetOrder).map(([k]) => k))]
      : [bookDecoded.toLowerCase()];

  // Load passages for all aliases
  const aliasResults = await Promise.all(
    aliases.map((alias) =>
      admin
        .from("passages")
        .select("reference, manuscript_id")
        .ilike("reference", `${alias} %`)
        .not("original_text", "is", null)
    )
  );

  const seenIds = new Set<string>();
  const chapters = new Set<number>();
  const manuscripts = new Set<string>();

  for (const { data } of aliasResults) {
    for (const p of data ?? []) {
      const [, ch] = parseReference(p.reference);
      if (ch > 0 && !seenIds.has(p.reference + p.manuscript_id)) {
        seenIds.add(p.reference + p.manuscript_id);
        chapters.add(ch);
        manuscripts.add(p.manuscript_id);
      }
    }
  }

  if (chapters.size === 0) notFound();

  const sortedChapters = [...chapters].sort((a, b) => a - b);

  // Load cached book summary + chapter summaries in parallel
  const [{ data: bookSummaryRow }, { data: chapterSummaryRows }] = await Promise.all([
    admin
      .from("ai_summaries")
      .select("content, model, generated_at, version")
      .eq("level", "book")
      .eq("scope_key", bookDecoded)
      .single(),
    admin
      .from("ai_summaries")
      .select("scope_key")
      .eq("level", "chapter")
      .ilike("scope_key", `${bookDecoded} %`),
  ]);

  const summarizedChapters = new Set<number>(
    (chapterSummaryRows ?? []).map((r) => {
      const parts = r.scope_key.split(" ");
      return parseInt(parts[parts.length - 1], 10);
    }).filter(Boolean)
  );

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAuthenticated = !!user;

  const ADMIN_ROLES = ["admin", "editor", "contributor"];
  let userRole: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single<{ role: string }>();
    userRole = profile?.role ?? null;
  }
  const isAdmin = !!userRole && ADMIN_ROLES.includes(userRole);

  const cachedSummary = bookSummaryRow?.content
    ? (bookSummaryRow.content as unknown as BookSummaryContent)
    : null;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/read" className="hover:text-primary-600 dark:hover:text-primary-400">
          Scripture Browser
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 dark:text-gray-100">{bookDecoded}</span>
      </nav>

      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-gray-900 dark:text-gray-100">{bookDecoded}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {sortedChapters.length} chapter{sortedChapters.length !== 1 ? "s" : ""}
            {" · "}
            {manuscripts.size} manuscript{manuscripts.size !== 1 ? "s" : ""}
            {" · "}
            {summarizedChapters.size}/{sortedChapters.length} chapters summarized
          </p>
        </div>
        <Link
          href={`/read/${encodeURIComponent(bookDecoded)}/1`}
          className="shrink-0 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Read chapter 1 &rarr;
        </Link>
      </div>

      {/* Admin panel */}
      {isAdmin && <BookAdminPanel book={bookDecoded} />}

      {/* Summary panel */}
      <BookSummaryPanel
        book={bookDecoded}
        chapters={sortedChapters}
        summarizedChapters={summarizedChapters}
        cachedSummary={cachedSummary}
        generatedAt={bookSummaryRow?.generated_at ?? null}
        model={bookSummaryRow?.model ?? null}
        isAuthenticated={isAuthenticated}
      />

      {/* Chapter grid */}
      <div className="mt-8">
        <h2 className="mb-3 font-serif text-lg font-semibold text-gray-800 dark:text-gray-200">Chapters</h2>
        <div className="flex flex-wrap gap-2">
          {sortedChapters.map((ch) => {
            const hasSummary = summarizedChapters.has(ch);
            return (
              <Link
                key={ch}
                href={`/read/${encodeURIComponent(bookDecoded)}/${ch}`}
                title={hasSummary ? "Chapter summary available" : undefined}
                className={`relative flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
                  hasSummary
                    ? "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-gray-800 hover:border-primary-200 dark:hover:border-primary-800 hover:text-primary-700 dark:hover:text-primary-300"
                }`}
              >
                {ch}
                {hasSummary && (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-blue-400" />
                )}
              </Link>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          Blue chapters have AI summaries. Click any chapter to read.
        </p>
      </div>
    </div>
  );
}
