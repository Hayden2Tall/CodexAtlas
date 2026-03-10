import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VariantComparisonView } from "./variant-comparison-view";
import type { Variant, VariantReading, Manuscript } from "@/lib/types";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("variants")
    .select("passage_reference")
    .eq("id", id)
    .single<Pick<Variant, "passage_reference">>();

  return {
    title: data
      ? `${data.passage_reference} — Variant — CodexAtlas`
      : "Variant — CodexAtlas",
  };
}

export default async function VariantDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: variant } = await supabase
    .from("variants")
    .select("*")
    .eq("id", id)
    .single<Variant>();

  if (!variant) notFound();

  const { data: readings } = await supabase
    .from("variant_readings")
    .select("*, manuscripts(id, title, original_language, estimated_date_start, estimated_date_end)")
    .eq("variant_id", id)
    .order("created_at", { ascending: true })
    .returns<(VariantReading & { manuscripts: Pick<Manuscript, "id" | "title" | "original_language" | "estimated_date_start" | "estimated_date_end"> | null })[]>();

  const { data: sourcePassages } = await supabase
    .from("passages")
    .select("id, reference, manuscript_id, manuscripts!inner(id, title)")
    .eq("reference", variant.passage_reference)
    .not("original_text", "is", null)
    .returns<{ id: string; reference: string; manuscript_id: string; manuscripts: { id: string; title: string } }[]>();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const meta = variant.metadata as Record<string, unknown> | null;
  const significance = typeof meta?.significance === "string" ? meta.significance : null;
  const analysis = typeof meta?.analysis === "string" ? meta.analysis : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <nav className="mb-6 text-sm text-gray-500">
        <Link href="/variants" className="hover:text-primary-700">
          Variants
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{variant.passage_reference}</span>
      </nav>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-primary-900">
            {variant.passage_reference}
          </h1>
          {variant.description && (
            <p className="mt-1 text-gray-600">{variant.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {significance && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${significance === "major" ? "bg-red-50 text-red-700 ring-red-200" : significance === "orthographic" ? "bg-gray-50 text-gray-600 ring-gray-200" : "bg-yellow-50 text-yellow-700 ring-yellow-200"}`}>
                {significance}
              </span>
            )}
          </div>
        </div>
        {user && (
          <Link
            href={`/variants/${id}/readings/new`}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Reading
          </Link>
        )}
      </div>

      {analysis && (
        <div className="mb-6 rounded-lg border border-primary-100 bg-primary-50/30 p-4">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary-700">
            Scholarly Analysis
          </h2>
          <p className="text-sm text-gray-700">{analysis}</p>
        </div>
      )}

      <VariantComparisonView
        variant={variant}
        readings={readings ?? []}
      />

      {sourcePassages && sourcePassages.length > 0 && (
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            Source Passages
          </h2>
          <p className="mb-3 text-xs text-gray-500">
            Passages from different manuscripts at this reference:
          </p>
          <ul className="space-y-2">
            {sourcePassages.map((sp) => (
              <li key={sp.id}>
                <Link
                  href={`/manuscripts/${sp.manuscripts.id}/passages/${sp.id}/translate`}
                  className="flex items-center gap-2 text-sm text-primary-700 hover:text-primary-900 hover:underline"
                >
                  <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                  {sp.manuscripts.title} — {sp.reference}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
