import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { TranslationWorkspace } from "./translation-workspace";
import type { Passage, Manuscript, Translation, TranslationVersion, EvidenceRecord } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string; passageId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { passageId } = await params;
  return {
    title: `Translate ${passageId} — CodexAtlas`,
  };
}

export default async function TranslatePage({ params }: PageProps) {
  const { id: manuscriptId, passageId } = await params;
  const supabase = await createClient();

  const { data: passage } = await supabase
    .from("passages")
    .select("*")
    .eq("id", passageId)
    .eq("manuscript_id", manuscriptId)
    .single<Passage>();

  if (!passage) notFound();

  const { data: manuscript } = await supabase
    .from("manuscripts")
    .select("*")
    .eq("id", manuscriptId)
    .single<Manuscript>();

  if (!manuscript) notFound();

  const { data: translations } = await supabase
    .from("translations")
    .select("*")
    .eq("passage_id", passageId)
    .returns<Translation[]>();

  const translationIds = (translations ?? []).map((t) => t.id);

  const { data: versions } = translationIds.length
    ? await supabase
        .from("translation_versions")
        .select("*")
        .in("translation_id", translationIds)
        .order("version_number", { ascending: false })
        .returns<TranslationVersion[]>()
    : { data: [] as TranslationVersion[] };

  const evidenceIds = (versions ?? [])
    .map((v) => v.evidence_record_id)
    .filter(Boolean) as string[];

  const { data: evidenceRecords } = evidenceIds.length
    ? await supabase
        .from("evidence_records")
        .select("*")
        .in("id", evidenceIds)
        .returns<EvidenceRecord[]>()
    : { data: [] as EvidenceRecord[] };

  return (
    <div>
      <nav className="mb-6 flex items-center text-sm text-gray-500">
        <a
          href={`/manuscripts/${manuscriptId}`}
          className="transition-colors hover:text-primary-600"
        >
          {manuscript.title}
        </a>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{passage.reference}</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          Translate Passage
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {passage.reference} &mdash; {manuscript.original_language} source
        </p>
      </div>

      <TranslationWorkspace
        passage={passage}
        manuscript={manuscript}
        translations={translations ?? []}
        versions={versions ?? []}
        evidenceRecords={evidenceRecords ?? []}
      />
    </div>
  );
}
