import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { CompareSelector } from "./compare-selector";

interface PageProps {
  params: Promise<{ book: string; chapter: string }>;
}

interface PassageRow {
  id: string;
  reference: string;
  original_text: string | null;
  manuscript_id: string;
  transcription_method: string | null;
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
  evidence_record_id: string | null;
}

interface EvidenceRow {
  id: string;
  metadata: {
    translation_notes?: string;
    key_decisions?: string[];
  } | null;
}

async function loadCompareData(bookDecoded: string, chapterNum: number) {
  const admin = createAdminClient();
  const refPattern = `${bookDecoded} ${chapterNum}`;

  const { data: passageRows } = await admin
    .from("passages")
    .select(`
      id, reference, original_text, manuscript_id, transcription_method,
      manuscripts!inner(id, title, original_language, estimated_date_start, estimated_date_end)
    `)
    .ilike("reference", refPattern)
    .not("original_text", "is", null)
    .returns<PassageRow[]>();

  if (!passageRows?.length) return null;

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
        .select("id, translation_id, version_number, translated_text, translation_method, confidence_score, status, evidence_record_id")
        .in("id", versionIds)
        .eq("status", "published")
        .returns<VersionRow[]>()
    : { data: [] as VersionRow[] };

  // Fetch evidence records for translation notes and key decisions
  const evidenceIds = (versions ?? [])
    .map((v) => v.evidence_record_id)
    .filter(Boolean) as string[];

  const { data: evidenceRows } = evidenceIds.length
    ? await admin
        .from("evidence_records")
        .select("id, metadata")
        .in("id", evidenceIds)
        .returns<EvidenceRow[]>()
    : { data: [] as EvidenceRow[] };

  const evidenceById = new Map<string, EvidenceRow>();
  for (const e of evidenceRows ?? []) {
    evidenceById.set(e.id, e);
  }

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

  return passageRows
    .sort((a, b) => {
      const dateA = a.manuscripts.estimated_date_start ?? 9999;
      const dateB = b.manuscripts.estimated_date_start ?? 9999;
      return dateA - dateB;
    })
    .map((p) => {
      const tv = translationsByPassage.get(p.id);
      return {
        passageId: p.id,
        manuscriptId: p.manuscripts.id,
        manuscriptTitle: p.manuscripts.title,
        language: p.manuscripts.original_language,
        dateStart: p.manuscripts.estimated_date_start,
        dateEnd: p.manuscripts.estimated_date_end,
        originalText: p.original_text ?? "",
        translatedText: tv?.version.translated_text ?? null,
        translationMethod: tv?.version.translation_method ?? null,
        confidenceScore: tv?.version.confidence_score ?? null,
        translationNotes: tv?.version.evidence_record_id
          ? (evidenceById.get(tv.version.evidence_record_id)?.metadata?.translation_notes ?? null)
          : null,
        keyDecisions: tv?.version.evidence_record_id
          ? (evidenceById.get(tv.version.evidence_record_id)?.metadata?.key_decisions ?? [])
          : [],
      };
    });
}

function formatDate(start: number | null, end: number | null): string {
  const fmt = (y: number) => (y < 0 ? `${Math.abs(y)} BCE` : `${y} CE`);
  if (start != null && end != null) return `${fmt(start)}–${fmt(end)}`;
  if (start != null) return fmt(start);
  if (end != null) return fmt(end);
  return "";
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { book, chapter } = await params;
  const bookDecoded = decodeURIComponent(book);
  return {
    title: `Compare ${bookDecoded} ${chapter} — CodexAtlas`,
    description: `Side-by-side comparison of ${bookDecoded} ${chapter} across multiple ancient manuscripts.`,
  };
}

export default async function ComparePage({ params }: PageProps) {
  const { book, chapter } = await params;
  const bookDecoded = decodeURIComponent(book);
  const chapterNum = parseInt(chapter, 10);

  if (!bookDecoded || isNaN(chapterNum)) notFound();

  const manuscripts = await loadCompareData(bookDecoded, chapterNum);

  if (!manuscripts || manuscripts.length < 2) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center">
        <h1 className="font-serif text-2xl font-bold text-gray-900">
          Compare: {bookDecoded} {chapterNum}
        </h1>
        <p className="mt-4 text-gray-500">
          At least 2 manuscripts are needed for comparison.
          {manuscripts?.length === 1
            ? " Only 1 manuscript has this passage."
            : " No manuscripts have this passage."}
        </p>
        <Link
          href={`/read/${encodeURIComponent(bookDecoded)}/${chapterNum}`}
          className="mt-6 inline-block text-sm text-primary-700 hover:underline"
        >
          Back to reading view
        </Link>
      </div>
    );
  }

  const serialized = manuscripts.map((m) => ({
    passageId: m.passageId,
    manuscriptId: m.manuscriptId,
    manuscriptTitle: m.manuscriptTitle,
    language: m.language,
    dateLabel: formatDate(m.dateStart, m.dateEnd),
    originalText: m.originalText,
    translatedText: m.translatedText,
    translationMethod: m.translationMethod,
    confidenceScore: m.confidenceScore,
    translationNotes: m.translationNotes,
    keyDecisions: m.keyDecisions,
  }));

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="text-sm text-gray-500">
          <Link href="/read" className="hover:text-primary-600">
            Scripture Browser
          </Link>
          <span className="mx-2">/</span>
          <Link
            href={`/read/${encodeURIComponent(bookDecoded)}/${chapterNum}`}
            className="hover:text-primary-600"
          >
            {bookDecoded} {chapterNum}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">Compare</span>
        </nav>
      </div>

      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-gray-900">
          Compare: {bookDecoded} {chapterNum}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Side-by-side comparison across {manuscripts.length} manuscripts
        </p>
      </div>

      <CompareSelector manuscripts={serialized} book={bookDecoded} chapter={chapterNum} />
    </div>
  );
}
