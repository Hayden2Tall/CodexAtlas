import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  EvidenceRecord,
  TranslationVersion,
  Review,
  Manuscript,
} from "@/lib/types";

/**
 * GET /api/evidence/[id]
 *
 * Public endpoint (Open Research Model).
 * Returns a full evidence chain for a given entity — evidence record,
 * linked translation version, reviews, source manuscripts, audit trail.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = createAdminClient();

    // Try fetching as evidence_record ID first
    let { data: evidence } = await admin
      .from("evidence_records")
      .select("*")
      .eq("id", id)
      .single<EvidenceRecord>();

    // If not found, try as entity_id (e.g., translation_version ID)
    if (!evidence) {
      const { data } = await admin
        .from("evidence_records")
        .select("*")
        .eq("entity_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .returns<EvidenceRecord[]>();

      evidence = data?.[0] ?? null;
    }

    if (!evidence) {
      return NextResponse.json(
        { error: "Evidence record not found" },
        { status: 404 }
      );
    }

    // Fetch linked translation version if entity_type is translation_version
    let translationVersion: TranslationVersion | null = null;
    if (evidence.entity_type === "translation_version") {
      const { data } = await admin
        .from("translation_versions")
        .select("*")
        .eq("id", evidence.entity_id)
        .single<TranslationVersion>();
      translationVersion = data;
    }

    // Fetch reviews for this version
    let reviews: Review[] = [];
    if (translationVersion) {
      const { data } = await admin
        .from("reviews")
        .select("*")
        .eq("translation_version_id", translationVersion.id)
        .order("created_at", { ascending: false })
        .returns<Review[]>();
      reviews = data ?? [];
    }

    // Fetch source manuscripts
    let sourceManuscripts: Pick<Manuscript, "id" | "title" | "original_language">[] = [];
    if (evidence.source_manuscript_ids && evidence.source_manuscript_ids.length > 0) {
      const { data } = await admin
        .from("manuscripts")
        .select("id, title, original_language")
        .in("id", evidence.source_manuscript_ids)
        .returns<Pick<Manuscript, "id" | "title" | "original_language">[]>();
      sourceManuscripts = data ?? [];
    }

    // Fetch related evidence records (other versions of the same entity)
    let relatedEvidence: EvidenceRecord[] = [];
    if (translationVersion) {
      const { data } = await admin
        .from("evidence_records")
        .select("*")
        .eq("entity_type", "translation_version")
        .neq("id", evidence.id)
        .order("created_at", { ascending: false })
        .limit(10)
        .returns<EvidenceRecord[]>();

      // Filter to those with the same translation_id
      const sameTranslation = (data ?? []).filter((e) => {
        return true; // Include all for now; we'll filter client-side
      });
      relatedEvidence = sameTranslation;
    }

    return NextResponse.json({
      evidence,
      translation_version: translationVersion,
      reviews,
      source_manuscripts: sourceManuscripts,
      related_evidence: relatedEvidence,
    });
  } catch (err) {
    console.error("GET /api/evidence/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
