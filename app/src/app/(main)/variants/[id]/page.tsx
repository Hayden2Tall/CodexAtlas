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
    .select("*, manuscripts(id, title, original_language)")
    .eq("variant_id", id)
    .order("created_at", { ascending: true })
    .returns<(VariantReading & { manuscripts: Pick<Manuscript, "id" | "title" | "original_language"> | null })[]>();

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
        </div>
        {user && (
          <Link
            href={`/variants/${id}/readings/new`}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-800"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            Add Reading
          </Link>
        )}
      </div>

      <VariantComparisonView
        variant={variant}
        readings={readings ?? []}
      />
    </div>
  );
}
