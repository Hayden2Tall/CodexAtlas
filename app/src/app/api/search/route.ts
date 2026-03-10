import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Manuscript, Passage, TranslationVersion } from "@/lib/types";

interface SearchResult {
  type: "manuscript" | "passage" | "translation";
  id: string;
  title: string;
  subtitle: string;
  snippet: string;
  href: string;
  language?: string;
  date_range?: string;
  confidence?: number;
}

/**
 * GET /api/search?q=...&type=...&language=...&limit=...
 *
 * Public endpoint — no auth required (Open Research Model).
 * Searches manuscripts, passages (full-text on original_text),
 * and translations (full-text on translated_text).
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const query = params.get("q")?.trim();
    const typeFilter = params.get("type");
    const languageFilter = params.get("language");
    const limit = Math.min(parseInt(params.get("limit") ?? "20", 10), 50);

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: "Query must be at least 2 characters" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const results: SearchResult[] = [];

    const searchTypes = typeFilter
      ? [typeFilter]
      : ["manuscript", "passage", "translation"];

    if (searchTypes.includes("manuscript")) {
      const { data: manuscripts } = await admin
        .from("manuscripts")
        .select("id, title, original_language, description, estimated_date_start, estimated_date_end, origin_location")
        .is("archived_at", null)
        .or(`title.ilike.%${query}%,description.ilike.%${query}%,historical_context.ilike.%${query}%,origin_location.ilike.%${query}%,archive_location.ilike.%${query}%`)
        .limit(limit)
        .returns<Pick<Manuscript, "id" | "title" | "original_language" | "description" | "estimated_date_start" | "estimated_date_end" | "origin_location">[]>();

      for (const m of manuscripts ?? []) {
        results.push({
          type: "manuscript",
          id: m.id,
          title: m.title,
          subtitle: m.original_language,
          snippet: m.description?.slice(0, 200) ?? "",
          href: `/manuscripts/${m.id}`,
          language: m.original_language,
          date_range: formatDateRange(m.estimated_date_start, m.estimated_date_end),
        });
      }
    }

    if (searchTypes.includes("passage")) {
      const tsQuery = query.split(/\s+/).join(" & ");

      const { data: passages } = await admin
        .from("passages")
        .select("id, reference, original_text, manuscript_id, manuscripts!inner(title)")
        .not("original_text", "is", null)
        .or(`reference.ilike.%${query}%,original_text.ilike.%${query}%`)
        .limit(limit)
        .returns<(Pick<Passage, "id" | "reference" | "original_text" | "manuscript_id"> & { manuscripts: { title: string } })[]>();

      // Also do full-text search for better coverage on original text
      let ftsPassages: typeof passages = [];
      if (tsQuery) {
        const { data } = await admin
          .from("passages")
          .select("id, reference, original_text, manuscript_id, manuscripts!inner(title)")
          .not("original_text", "is", null)
          .textSearch("original_text", tsQuery, { type: "plain", config: "simple" })
          .limit(limit)
          .returns<(Pick<Passage, "id" | "reference" | "original_text" | "manuscript_id"> & { manuscripts: { title: string } })[]>();
        ftsPassages = data ?? [];
      }

      const allPassages = dedup([...(passages ?? []), ...ftsPassages], "id");

      for (const p of allPassages.slice(0, limit)) {
        results.push({
          type: "passage",
          id: p.id,
          title: p.reference,
          subtitle: p.manuscripts.title,
          snippet: p.original_text?.slice(0, 200) ?? "",
          href: `/manuscripts/${p.manuscript_id}/passages/${p.id}/translate`,
        });
      }
    }

    if (searchTypes.includes("translation")) {
      const tsQuery = query.split(/\s+/).join(" & ");

      const { data: versions } = await admin
        .from("translation_versions")
        .select("id, translated_text, confidence_score, ai_model, translation_id, translations!inner(passage_id, passages!inner(reference, manuscript_id, manuscripts!inner(title)))")
        .eq("status", "published")
        .textSearch("translated_text", tsQuery, { type: "plain", config: "english" })
        .limit(limit)
        .returns<(Pick<TranslationVersion, "id" | "translated_text" | "confidence_score" | "ai_model" | "translation_id"> & {
          translations: {
            passage_id: string;
            passages: { reference: string; manuscript_id: string; manuscripts: { title: string } };
          };
        })[]>();

      for (const v of versions ?? []) {
        const passage = v.translations.passages;
        results.push({
          type: "translation",
          id: v.id,
          title: passage.reference,
          subtitle: passage.manuscripts.title,
          snippet: v.translated_text.slice(0, 200),
          href: `/manuscripts/${passage.manuscript_id}/passages/${v.translations.passage_id}/translate`,
          confidence: v.confidence_score ?? undefined,
        });
      }
    }

    // Apply language filter if specified
    const filtered = languageFilter
      ? results.filter((r) => r.language === languageFilter || r.type !== "manuscript")
      : results;

    return NextResponse.json({
      results: filtered.slice(0, limit),
      total: filtered.length,
      query,
    });
  } catch (err) {
    console.error("GET /api/search error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function formatDateRange(start: number | null, end: number | null): string {
  if (!start && !end) return "";
  const fmt = (n: number) => (n < 0 ? `${Math.abs(n)} BCE` : `${n} CE`);
  if (start && end) return `${fmt(start)}\u2013${fmt(end)}`;
  return `c. ${fmt(start ?? end!)}`;
}

function dedup<T extends Record<string, unknown>>(arr: T[], key: string): T[] {
  const seen = new Set<unknown>();
  return arr.filter((item) => {
    const val = item[key];
    if (seen.has(val)) return false;
    seen.add(val);
    return true;
  });
}
