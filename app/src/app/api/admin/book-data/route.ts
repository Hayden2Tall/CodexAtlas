import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BOOK_ORDER } from "@/lib/utils/book-order";
import type { UserRole } from "@/lib/types";

const ALLOWED_ROLES: UserRole[] = ["admin", "editor", "contributor"];

/**
 * GET /api/admin/book-data?book=<book>
 *
 * Returns data needed for the BookAdminPanel:
 * - passages: all passage ids + references for the book
 * - manuscripts: unique manuscripts with summary status
 * - chapters: each chapter's summary/cross-manuscript status + manuscript count
 *
 * Auth: admin, editor, contributor only.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single<{ role: UserRole }>();

    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const book = searchParams.get("book");

    if (!book) {
      return NextResponse.json({ error: "book query param required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Resolve aliases (e.g. "Psalm"/"Psalms")
    const targetOrder = BOOK_ORDER[book.toLowerCase()] ?? 999;
    const aliases =
      targetOrder !== 999
        ? [...new Set(Object.entries(BOOK_ORDER).filter(([, v]) => v === targetOrder).map(([k]) => k))]
        : [book.toLowerCase()];

    // Fetch passages for all aliases
    const passageResults = await Promise.all(
      aliases.map((alias) =>
        admin
          .from("passages")
          .select("id, reference, manuscript_id, metadata")
          .ilike("reference", `${alias} %`)
          .not("original_text", "is", null)
      )
    );

    // Deduplicate passages (same id can appear via multiple alias queries)
    const passageMap = new Map<string, { id: string; reference: string; manuscript_id: string; metadata: Record<string, unknown> | null }>();
    for (const { data } of passageResults) {
      for (const p of data ?? []) {
        passageMap.set(p.id, p as { id: string; reference: string; manuscript_id: string; metadata: Record<string, unknown> | null });
      }
    }
    const allPassages = [...passageMap.values()];

    // Derive chapters and manuscripts from passages
    const chapterManuscripts = new Map<number, Set<string>>(); // chapter -> set of manuscript_ids
    const manuscriptIds = new Set<string>();

    for (const p of allPassages) {
      // Parse chapter number from reference like "John 3" or "John 3:16"
      const parts = p.reference.split(" ");
      const chNum = parseInt(parts[parts.length - 1]?.split(":")[0] ?? "0", 10);
      if (chNum > 0) {
        if (!chapterManuscripts.has(chNum)) chapterManuscripts.set(chNum, new Set());
        chapterManuscripts.get(chNum)!.add(p.manuscript_id);
        manuscriptIds.add(p.manuscript_id);
      }
    }

    // Load manuscript details (title + summary status via metadata)
    const { data: manuscriptRows } = await admin
      .from("manuscripts")
      .select("id, title, metadata")
      .in("id", [...manuscriptIds]);

    // Load existing chapter summaries for this book
    const { data: chapterSummaryRows } = await admin
      .from("ai_summaries")
      .select("scope_key")
      .eq("level", "chapter")
      .ilike("scope_key", `${book} %`);

    const summarizedChapters = new Set<number>(
      (chapterSummaryRows ?? []).map((r) => {
        const parts = r.scope_key.split(" ");
        return parseInt(parts[parts.length - 1], 10);
      }).filter(Boolean)
    );

    // Load existing cross-manuscript summaries for this book
    const { data: crossRows } = await admin
      .from("ai_summaries")
      .select("scope_key")
      .eq("level", "cross_manuscript")
      .ilike("scope_key", `${book} %`);

    const crossSummarizedChapters = new Set<number>(
      (crossRows ?? []).map((r) => {
        const parts = r.scope_key.split(" ");
        return parseInt(parts[parts.length - 1], 10);
      }).filter(Boolean)
    );

    // Find translated passage IDs
    const allPassageIds = allPassages.map((p) => p.id);
    const { data: translationRows } = await admin
      .from("translations")
      .select("passage_id")
      .in("passage_id", allPassageIds)
      .not("current_version_id", "is", null);

    const translatedIds = new Set((translationRows ?? []).map((r) => r.passage_id as string));

    // Build response
    const passages = allPassages.map((p) => ({ id: p.id, reference: p.reference }));
    const untranslated_passages = allPassages
      .filter((p) => !translatedIds.has(p.id))
      .map((p) => ({ id: p.id, reference: p.reference }));
    const unsummarized_passages = allPassages
      .filter((p) => !(p.metadata as Record<string, unknown> | null)?.ai_summary)
      .map((p) => ({ id: p.id, reference: p.reference }));

    const manuscripts = (manuscriptRows ?? []).map((ms) => ({
      id: ms.id,
      title: ms.title as string,
      has_summary: !!(ms.metadata as Record<string, unknown> | null)?.ai_summary,
    }));

    const chapters = [...chapterManuscripts.entries()]
      .sort(([a], [b]) => a - b)
      .map(([num, msIds]) => ({
        number: num,
        manuscript_count: msIds.size,
        has_summary: summarizedChapters.has(num),
        has_cross_manuscript: crossSummarizedChapters.has(num),
      }));

    return NextResponse.json({ passages, manuscripts, chapters, untranslated_passages, unsummarized_passages });
  } catch (err) {
    console.error("[admin/book-data] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
