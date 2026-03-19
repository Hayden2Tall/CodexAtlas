import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { BOOK_ORDER, parseReference } from "@/lib/utils/book-order";

export const dynamic = "force-dynamic";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { MethodBadge } from "@/components/ui/method-badge";
import { PassageSummary } from "@/components/scripture/passage-summary";
import { ChapterNav } from "./chapter-nav";
import { ShareButton } from "@/components/ui/share-button";
import { ChapterAdminBar } from "./chapter-admin-bar";
import { ChapterSummary } from "@/components/scripture/chapter-summary";

interface PageProps {
  params: Promise<{ book: string; chapter: string }>;
}

interface PassageRow {
  id: string;
  reference: string;
  original_text: string | null;
  manuscript_id: string;
  transcription_method: string | null;
  metadata: Record<string, unknown> | null;
  manuscripts: {
    id: string;
    title: string;
    original_language: string;
    estimated_date_start: number | null;
    estimated_date_end: number | null;
  };
}

interface TranslationJoin {
  id: string;
  passage_id: string;
  target_language: string;
  current_version_id: string | null;
}

interface VersionRow {
  id: string;
  translation_id: string;
  version_number: number;
  translated_text: string;
  translation_method: string;
  confidence_score: number | null;
  status: string;
}

async function loadChapterData(bookDecoded: string, chapterNum: number) {
  const admin = createAdminClient();

  // Query across all known aliases for this book so "Psalm" and "Psalms" both match.
  // Use separate ilike queries per alias (avoids PostgREST .or() parser issues with spaces).
  const targetOrder = BOOK_ORDER[bookDecoded.toLowerCase()] ?? 999;
  const aliases = targetOrder !== 999
    ? [...new Set(Object.entries(BOOK_ORDER).filter(([, v]) => v === targetOrder).map(([k]) => k))]
    : [bookDecoded.toLowerCase()];

  const SELECT = `
    id, reference, original_text, manuscript_id, transcription_method, metadata,
    manuscripts!inner(id, title, original_language, estimated_date_start, estimated_date_end)
  `;

  const aliasResults = await Promise.all(
    aliases.map((alias) =>
      admin
        .from("passages")
        .select(SELECT)
        .ilike("reference", `${alias} ${chapterNum}%`)
        .not("original_text", "is", null)
        .returns<PassageRow[]>()
    )
  );

  const seenIds = new Set<string>();
  const passageRows: PassageRow[] = [];
  for (const { data, error } of aliasResults) {
    if (error) console.error(`[chapter-page] loadChapterData query error for "${bookDecoded}" ch${chapterNum}:`, error.message);
    for (const row of data ?? []) {
      if (!seenIds.has(row.id)) {
        seenIds.add(row.id);
        passageRows.push(row);
      }
    }
  }

  console.log(`[chapter-page] "${bookDecoded}" ch${chapterNum}: found ${passageRows.length} passages via aliases [${aliases.join(",")}]`);

  if (!passageRows.length) return null;

  const passageIds = passageRows.map((p) => p.id);

  const { data: translations } = await admin
    .from("translations")
    .select("id, passage_id, target_language, current_version_id")
    .in("passage_id", passageIds)
    .returns<TranslationJoin[]>();

  const versionIds = (translations ?? [])
    .map((t) => t.current_version_id)
    .filter(Boolean) as string[];

  const { data: versions } = versionIds.length
    ? await admin
        .from("translation_versions")
        .select("id, translation_id, version_number, translated_text, translation_method, confidence_score, status")
        .in("id", versionIds)
        .eq("status", "published")
        .returns<VersionRow[]>()
    : { data: [] as VersionRow[] };

  const versionByTranslation = new Map<string, VersionRow>();
  for (const v of versions ?? []) {
    versionByTranslation.set(v.translation_id, v);
  }

  const translationsByPassage = new Map<string, { translation: TranslationJoin; version: VersionRow }>();
  for (const t of translations ?? []) {
    const v = versionByTranslation.get(t.id);
    if (!v) continue;
    const existing = translationsByPassage.get(t.passage_id);
    if (!existing || (v.confidence_score ?? 0) > (existing.version.confidence_score ?? 0)) {
      translationsByPassage.set(t.passage_id, { translation: t, version: v });
    }
  }

  const results = passageRows
    .sort((a, b) => {
      const dateA = a.manuscripts.estimated_date_start ?? 9999;
      const dateB = b.manuscripts.estimated_date_start ?? 9999;
      return dateA - dateB;
    })
    .map((p) => {
      const tv = translationsByPassage.get(p.id);
      return {
        passage: {
          id: p.id,
          reference: p.reference,
          original_text: p.original_text,
          manuscript_id: p.manuscript_id,
          transcription_method: p.transcription_method,
          metadata: p.metadata,
        },
        manuscript: p.manuscripts,
        translation: tv
          ? {
              target_language: tv.translation.target_language,
              translated_text: tv.version.translated_text,
              translation_method: tv.version.translation_method,
              confidence_score: tv.version.confidence_score,
              version_number: tv.version.version_number,
            }
          : null,
      };
    });

  return results;
}

interface ChapterSummaryContent {
  overview: string;
  theological_themes: string[];
  manuscript_notes: string;
  scholarly_significance: string;
}

async function loadCachedChapterSummary(
  bookDecoded: string,
  chapterNum: number
): Promise<ChapterSummaryContent | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ai_summaries")
    .select("content")
    .eq("level", "chapter")
    .eq("scope_key", `${bookDecoded} ${chapterNum}`)
    .single();
  return (data?.content as ChapterSummaryContent | null) ?? null;
}

async function loadChapterVariants(bookDecoded: string, chapterNum: number) {
  const admin = createAdminClient();
  const refPattern = `${bookDecoded} ${chapterNum}%`;

  const { data: variants } = await admin
    .from("variants")
    .select("id, passage_reference, description, metadata")
    .ilike("passage_reference", refPattern);

  return variants ?? [];
}

async function loadAvailableChapters(bookDecoded: string) {
  const admin = createAdminClient();
  const { data: passages } = await admin
    .from("passages")
    .select("reference")
    .not("original_text", "is", null)
    .neq("original_text", "");

  const chapters = new Set<number>();
  const targetOrder = BOOK_ORDER[bookDecoded.toLowerCase()] ?? 999;
  const bookLower = bookDecoded.toLowerCase();

  for (const p of passages ?? []) {
    const [order, chapter] = parseReference(p.reference);
    if (chapter === 0) continue;
    if (targetOrder !== 999 && order === targetOrder) {
      chapters.add(chapter);
    } else if (targetOrder === 999) {
      // Unknown book: fall back to exact name match
      const match = p.reference.match(/^(.+?)\s+(\d+)/);
      if (match && match[1].trim().toLowerCase() === bookLower) {
        chapters.add(parseInt(match[2], 10));
      }
    }
  }

  return [...chapters].sort((a, b) => a - b);
}

function formatDateRange(start: number | null, end: number | null): string {
  if (start == null && end == null) return "";
  const fmt = (y: number) => (y < 0 ? `${Math.abs(y)} BCE` : `${y} CE`);
  if (start != null && end != null) return `${fmt(start)}–${fmt(end)}`;
  return fmt(start ?? end!);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { book, chapter } = await params;
  const bookDecoded = decodeURIComponent(book);
  const title = `${bookDecoded} ${chapter} — CodexAtlas`;
  const description = `Read ${bookDecoded} chapter ${chapter} across ancient manuscripts with transparent AI translations and full evidence chains.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: "CodexAtlas",
      type: "article",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function ChapterPage({ params }: PageProps) {
  const { book, chapter } = await params;
  const bookDecoded = decodeURIComponent(book);
  const chapterNum = parseInt(chapter, 10);

  if (!bookDecoded || isNaN(chapterNum)) notFound();

  const [results, availableChapters, chapterVariants, cachedChapterSummary] = await Promise.all([
    loadChapterData(bookDecoded, chapterNum),
    loadAvailableChapters(bookDecoded),
    loadChapterVariants(bookDecoded, chapterNum),
    loadCachedChapterSummary(bookDecoded, chapterNum),
  ]);

  const variantsByRef = new Map<string, typeof chapterVariants>();
  for (const v of chapterVariants) {
    const existing = variantsByRef.get(v.passage_reference) ?? [];
    existing.push(v);
    variantsByRef.set(v.passage_reference, existing);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAuthenticated = !!user;

  let userRole: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single<{ role: string }>();
    userRole = profile?.role ?? null;
  }
  const isAdmin = ["admin", "editor"].includes(userRole ?? "");

  if (!results || results.length === 0) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center">
        <h1 className="font-serif text-2xl font-bold text-gray-900">
          {bookDecoded} {chapterNum}
        </h1>
        <p className="mt-4 text-gray-500">
          No manuscripts contain this passage yet.
        </p>
        <Link href="/read" className="mt-6 inline-block text-sm text-primary-700 hover:underline">
          Back to Scripture Browser
        </Link>
      </div>
    );
  }

  const prevChapter = availableChapters.filter((c) => c < chapterNum).pop();
  const nextChapter = availableChapters.find((c) => c > chapterNum);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Breadcrumb + Navigator */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="text-sm text-gray-500">
          <Link href="/read" className="hover:text-primary-600">
            Scripture Browser
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">
            {bookDecoded} {chapterNum}
          </span>
        </nav>

        <ChapterNav
          book={bookDecoded}
          currentChapter={chapterNum}
          chapters={availableChapters}
        />
      </div>

      {/* Chapter heading */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-gray-900">
            {bookDecoded} {chapterNum}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {results.length} manuscript{results.length !== 1 ? "s" : ""} contain
            this passage
          </p>
        </div>
        <ShareButton title={`${bookDecoded} ${chapterNum} — CodexAtlas`} />
      </div>

      {/* Admin: translate untranslated passages in this chapter */}
      <ChapterAdminBar
        untranslatedPassages={
          isAdmin
            ? results.filter((r) => r.translation === null).map((r) => ({ id: r.passage.id, reference: r.passage.reference }))
            : []
        }
        totalManuscripts={results.length}
      />

      {/* Chapter overview */}
      <ChapterSummary
        book={bookDecoded}
        chapter={chapterNum}
        cachedSummary={cachedChapterSummary}
        isAuthenticated={isAuthenticated}
      />

      {/* Manuscript passages */}
      <div className="space-y-8">
        {results.map((r) => (
          <article
            key={r.passage.id}
            className="rounded-xl border border-gray-200 bg-white overflow-hidden"
          >
            {/* Manuscript header */}
            <div className="border-b border-gray-100 bg-gray-50/50 px-5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/manuscripts/${r.manuscript.id}`}
                  className="font-medium text-gray-900 hover:text-primary-700"
                >
                  {r.manuscript.title}
                </Link>
                <span className="text-xs text-gray-400">
                  {r.manuscript.original_language.toUpperCase()}
                </span>
                {(r.manuscript.estimated_date_start || r.manuscript.estimated_date_end) && (
                  <span className="text-xs text-gray-400">
                    {formatDateRange(
                      r.manuscript.estimated_date_start,
                      r.manuscript.estimated_date_end,
                    )}
                  </span>
                )}
              </div>
            </div>

            <div className="p-5">
              {/* Translation (primary reading content) */}
              {r.translation ? (
                <div className="mb-4">
                  <p className="font-serif text-lg leading-relaxed text-gray-800">
                    {r.translation.translated_text}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <MethodBadge method={r.translation.translation_method} />
                    {r.translation.confidence_score != null && (
                      <ConfidenceBadge score={r.translation.confidence_score} />
                    )}
                    <span className="text-xs text-gray-400">
                      v{r.translation.version_number} &middot;{" "}
                      {r.translation.target_language}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="mb-4 text-sm italic text-gray-400">
                  No published translation yet
                </p>
              )}

              {/* Original text (collapsed by default via details) */}
              <details className="group">
                <summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-primary-700">
                  View original text ({r.manuscript.original_language})
                </summary>
                <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 p-4 font-mono text-sm leading-relaxed text-gray-700" dir={["heb", "ara", "syc"].includes(r.manuscript.original_language) ? "rtl" : "ltr"}>
                  {r.passage.original_text}
                </pre>
              </details>

              {/* Passage summary */}
              <PassageSummary
                passageId={r.passage.id}
                cachedSummary={
                  (r.passage.metadata as Record<string, unknown> | null)?.ai_summary
                    ? ((r.passage.metadata as Record<string, unknown>).ai_summary as { summary: string; historical_context: string; significance: string; key_themes: string[] })
                    : null
                }
                isAuthenticated={isAuthenticated}
              />

              {/* Variant indicator + link to full translation page */}
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3">
                <Link
                  href={`/manuscripts/${r.manuscript.id}/passages/${r.passage.id}/translate`}
                  className="text-xs font-medium text-primary-700 hover:underline"
                >
                  View full evidence chain &rarr;
                </Link>
                {(() => {
                  const passageVariants = variantsByRef.get(r.passage.reference);
                  if (!passageVariants?.length) return null;
                  const majorCount = passageVariants.filter(
                    (v) => (v.metadata as Record<string, unknown> | null)?.significance === "major"
                  ).length;
                  return (
                    <Link
                      href={`/variants/${passageVariants[0].id}`}
                      className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 hover:bg-amber-100"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                      </svg>
                      {passageVariants.length} variant{passageVariants.length !== 1 ? "s" : ""}
                      {majorCount > 0 && ` (${majorCount} major)`}
                    </Link>
                  );
                })()}
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Compare link */}
      {results.length >= 2 && (
        <div className="mt-8 text-center">
          <Link
            href={`/read/${encodeURIComponent(bookDecoded)}/${chapterNum}/compare`}
            className="inline-flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-5 py-2.5 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
            Compare {results.length} manuscripts side by side
          </Link>
        </div>
      )}

      {/* Prev / Next navigation */}
      <div className="mt-10 flex items-center justify-between border-t border-gray-200 pt-6">
        {prevChapter != null ? (
          <Link
            href={`/read/${encodeURIComponent(bookDecoded)}/${prevChapter}`}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-primary-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            {bookDecoded} {prevChapter}
          </Link>
        ) : (
          <span />
        )}
        {nextChapter != null ? (
          <Link
            href={`/read/${encodeURIComponent(bookDecoded)}/${nextChapter}`}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-primary-700"
          >
            {bookDecoded} {nextChapter}
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
