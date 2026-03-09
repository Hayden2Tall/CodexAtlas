import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PassageForm } from "./passage-form";
import type { Manuscript } from "@/lib/types";

interface NewPassagePageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: "New Passage — CodexAtlas",
};

export default async function NewPassagePage({ params }: NewPassagePageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: manuscript } = await supabase
    .from("manuscripts")
    .select("id, title")
    .eq("id", id)
    .single<Pick<Manuscript, "id" | "title">>();

  if (!manuscript) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <nav className="mb-6 text-sm text-gray-500">
        <Link href="/manuscripts" className="hover:text-primary-700">
          Manuscripts
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/manuscripts/${manuscript.id}`}
          className="hover:text-primary-700"
        >
          {manuscript.title}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">New Passage</span>
      </nav>

      <h1 className="mb-2 font-serif text-3xl font-bold text-primary-900">
        Add Passage
      </h1>
      <p className="mb-8 text-gray-600">
        Add a passage to{" "}
        <span className="font-medium text-gray-900">{manuscript.title}</span>.
      </p>

      <PassageForm manuscriptId={manuscript.id} />
    </div>
  );
}
