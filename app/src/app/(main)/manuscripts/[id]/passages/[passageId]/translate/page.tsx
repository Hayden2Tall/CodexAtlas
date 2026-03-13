import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { TranslationWorkspace } from "./translation-workspace";
import type { Passage, Manuscript, Translation, TranslationVersion, EvidenceRecord, Review, Variant } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string; passageId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id: manuscriptId, passageId } = await params;
  const supabase = await createClient();

  const { data: passage } = await supabase
    .from("passages")
    .select("reference")
    .eq("id", passageId)
    .eq("manuscript_id", manuscriptId)
    .single<{ reference: string }>();

  const { data: manuscript } = await supabase
    .from("manuscripts")
    .select("title")
    .eq("id", manuscriptId)
    .single<{ title: string }>();

  const ref = passage?.reference ?? passageId;
  const ms = manuscript?.title ?? "Manuscript";
  const title = `${ref} (${ms}) — CodexAtlas`;
  const description = `Translation and evidence chain for ${ref} from ${ms}. AI-assisted translation with transparent source provenance.`;

  return {
    title,
    description,
    openGraph: { title, description, siteName: "CodexAtlas", type: "article" },
    twitter: { card: "summary", title, description },
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

  const versionIds = (versions ?? []).map((v) => v.id);

  const { data: reviews } = versionIds.length
    ? await supabase
        .from("reviews")
        .select("*, users(display_name)")
        .in("translation_version_id", versionIds)
        .order("created_at", { ascending: false })
        .returns<(Review & { users: { display_name: string | null } | null })[]>()
    : { data: [] as (Review & { users: { display_name: string | null } | null })[] };

  const { data: relatedVariants } = await supabase
    .from("variants")
    .select("id, passage_reference, description, metadata")
    .eq("passage_reference", passage.reference)
    .order("created_at", { ascending: false })
    .returns<Pick<Variant, "id" | "passage_reference" | "description" | "metadata">[]>();

  const { data: { user } } = await supabase.auth.getUser();
  const isAuthenticated = !!user;

  const { data: userProfile } = user
    ? await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single<{ role: string }>()
    : { data: null };

  const userRole = userProfile?.role ?? null;

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
          Translation
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
        reviews={reviews ?? []}
        isAuthenticated={isAuthenticated}
        userRole={userRole}
      />

      {relatedVariants && relatedVariants.length > 0 && (
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            Textual Variants at This Reference
          </h2>
          <ul className="space-y-2">
            {relatedVariants.map((v) => {
              const sig = (v.metadata as Record<string, unknown> | null)?.significance;
              return (
                <li key={v.id} className="flex items-center gap-3">
                  <Link
                    href={`/variants/${v.id}`}
                    className="text-sm text-primary-700 hover:text-primary-900 hover:underline"
                  >
                    {v.description || v.passage_reference}
                  </Link>
                  {typeof sig === "string" && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${sig === "major" ? "bg-red-50 text-red-700 ring-red-200" : sig === "orthographic" ? "bg-gray-50 text-gray-600 ring-gray-200" : "bg-yellow-50 text-yellow-700 ring-yellow-200"}`}>
                      {sig}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
