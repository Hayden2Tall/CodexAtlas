import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const revalidate = 3600;

export async function GET() {
  try {
    const admin = createAdminClient();

    const [manuscripts, passages, translatedPassages, languages] = await Promise.all([
      admin.from("manuscripts").select("id", { count: "exact", head: true }).is("archived_at", null),
      admin.from("passages").select("id", { count: "exact", head: true }).not("original_text", "is", null),
      admin
        .from("translation_versions")
        .select("id", { count: "exact", head: true })
        .eq("status", "published"),
      admin.from("manuscripts").select("original_language").is("archived_at", null),
    ]);

    const uniqueLanguages = new Set((languages.data ?? []).map((m) => m.original_language));

    const { data: featured } = await admin
      .from("manuscripts")
      .select("id, title, original_language, estimated_date_start, estimated_date_end, description")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(6);

    const { data: recentTranslations } = await admin
      .from("translation_versions")
      .select(`
        id, translated_text, confidence_score, translation_method, created_at,
        translations!inner(id, passage_id, target_language,
          passages!inner(id, reference, manuscript_id,
            manuscripts!inner(id, title)
          )
        )
      `)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(5);

    return NextResponse.json({
      counts: {
        manuscripts: manuscripts.count ?? 0,
        passages: passages.count ?? 0,
        translations: translatedPassages.count ?? 0,
        languages: uniqueLanguages.size,
      },
      featured: featured ?? [],
      recentTranslations: (recentTranslations ?? []).map((tv) => {
        const t = tv.translations as unknown as {
          id: string;
          target_language: string;
          passages: { id: string; reference: string; manuscript_id: string; manuscripts: { id: string; title: string } };
        };
        return {
          id: tv.id,
          snippet: tv.translated_text?.slice(0, 200) ?? "",
          confidence_score: tv.confidence_score,
          translation_method: tv.translation_method,
          created_at: tv.created_at,
          target_language: t.target_language,
          passage_reference: t.passages.reference,
          passage_id: t.passages.id,
          manuscript_id: t.passages.manuscript_id,
          manuscript_title: t.passages.manuscripts.title,
        };
      }),
    });
  } catch (err) {
    console.error("[stats] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
