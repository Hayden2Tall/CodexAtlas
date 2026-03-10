import { createAdminClient } from "@/lib/supabase/admin";
import { EvidenceExplorer } from "./evidence-explorer";
import type { EvidenceRecord, TranslationVersion, Review, Manuscript } from "@/lib/types";

export const metadata = {
  title: "Evidence Explorer — CodexAtlas",
};

export default async function EvidencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  let { data: evidence } = await admin
    .from("evidence_records")
    .select("*")
    .eq("id", id)
    .single<EvidenceRecord>();

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
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          Evidence not found
        </h1>
        <p className="mt-2 text-gray-600">
          No evidence record found for this ID.
        </p>
      </div>
    );
  }

  let translationVersion: TranslationVersion | null = null;
  if (evidence.entity_type === "translation_version") {
    const { data } = await admin
      .from("translation_versions")
      .select("*")
      .eq("id", evidence.entity_id)
      .single<TranslationVersion>();
    translationVersion = data;
  }

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

  let sourceManuscripts: Pick<Manuscript, "id" | "title" | "original_language">[] = [];
  if (evidence.source_manuscript_ids?.length) {
    const { data } = await admin
      .from("manuscripts")
      .select("id, title, original_language")
      .in("id", evidence.source_manuscript_ids)
      .returns<Pick<Manuscript, "id" | "title" | "original_language">[]>();
    sourceManuscripts = data ?? [];
  }

  return (
    <EvidenceExplorer
      evidence={evidence}
      translationVersion={translationVersion}
      reviews={reviews}
      sourceManuscripts={sourceManuscripts}
    />
  );
}
