import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const revalidate = 300;

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

interface TranslationRow {
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ book: string; chapter: string }> }
) {
  try {
    const { book, chapter } = await params;
    const bookDecoded = decodeURIComponent(book).trim();
    const chapterNum = parseInt(chapter, 10);

    if (!bookDecoded || isNaN(chapterNum)) {
      return NextResponse.json({ error: "Invalid book or chapter" }, { status: 400 });
    }

    const admin = createAdminClient();

    const refPattern = `${bookDecoded} ${chapterNum}`;

    const { data: passageRows, error } = await admin
      .from("passages")
      .select(`
        id, reference, original_text, manuscript_id, transcription_method, metadata,
        manuscripts!inner(id, title, original_language, estimated_date_start, estimated_date_end)
      `)
      .ilike("reference", refPattern)
      .not("original_text", "is", null)
      .returns<PassageRow[]>();

    if (error) {
      console.error("[scripture/chapter] query error:", error.message);
      return NextResponse.json({ error: "Failed to load chapter" }, { status: 500 });
    }

    if (!passageRows?.length) {
      return NextResponse.json({ passages: [], book: bookDecoded, chapter: chapterNum });
    }

    const passageIds = passageRows.map((p) => p.id);

    const { data: translations } = await admin
      .from("translations")
      .select("id, passage_id, target_language, current_version_id")
      .in("passage_id", passageIds)
      .returns<TranslationRow[]>();

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

    const translationsByPassage = new Map<string, { translation: TranslationRow; version: VersionRow }>();
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
                id: tv.translation.id,
                target_language: tv.translation.target_language,
                translated_text: tv.version.translated_text,
                translation_method: tv.version.translation_method,
                confidence_score: tv.version.confidence_score,
                version_number: tv.version.version_number,
              }
            : null,
        };
      });

    return NextResponse.json({
      book: bookDecoded,
      chapter: chapterNum,
      passages: results,
      manuscriptCount: new Set(passageRows.map((p) => p.manuscript_id)).size,
    });
  } catch (err) {
    console.error("[scripture/chapter] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
