import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReadingForm } from "./reading-form";
import type { Variant, Manuscript } from "@/lib/types";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: "Add Reading — CodexAtlas",
  description: "Add a manuscript reading to a textual variant.",
};

export default async function NewReadingPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: variant } = await supabase
    .from("variants")
    .select("id, passage_reference")
    .eq("id", id)
    .single<Pick<Variant, "id" | "passage_reference">>();

  if (!variant) notFound();

  const { data: manuscripts } = await supabase
    .from("manuscripts")
    .select("id, title")
    .is("archived_at", null)
    .order("title", { ascending: true })
    .returns<Pick<Manuscript, "id" | "title">[]>();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <nav className="mb-6 text-sm text-gray-500">
        <Link href="/variants" className="hover:text-primary-700">
          Variants
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/variants/${id}`}
          className="hover:text-primary-700"
        >
          {variant.passage_reference}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">Add Reading</span>
      </nav>

      <h1 className="mb-6 font-serif text-2xl font-bold text-primary-900">
        Add Reading
      </h1>

      <ReadingForm
        variantId={id}
        manuscripts={manuscripts ?? []}
      />
    </div>
  );
}
