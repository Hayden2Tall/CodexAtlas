import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ManuscriptDetail } from "./manuscript-detail";
import { parseReference } from "@/lib/utils/book-order";
import type { Manuscript, Passage, ManuscriptImage } from "@/lib/types";

interface ManuscriptPageProps {
  params: Promise<{ id: string }>;
}

function sortPassagesByReference(passages: Passage[]): Passage[] {
  return [...passages].sort((a, b) => {
    if (a.sequence_order != null && b.sequence_order != null) {
      return a.sequence_order - b.sequence_order;
    }
    const [aBook, aCh] = parseReference(a.reference);
    const [bBook, bCh] = parseReference(b.reference);
    if (aBook !== bBook) return aBook - bBook;
    return aCh - bCh;
  });
}

export async function generateMetadata({ params }: ManuscriptPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: manuscript } = await supabase
    .from("manuscripts")
    .select("title")
    .eq("id", id)
    .single<Pick<Manuscript, "title">>();

  return {
    title: manuscript
      ? `${manuscript.title} — CodexAtlas`
      : "Manuscript — CodexAtlas",
  };
}

export default async function ManuscriptPage({ params }: ManuscriptPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: manuscript } = await supabase
    .from("manuscripts")
    .select("*")
    .eq("id", id)
    .single<Manuscript>();

  if (!manuscript) notFound();

  const { data: rawPassages } = await supabase
    .from("passages")
    .select("*")
    .eq("manuscript_id", id)
    .order("sequence_order", { ascending: true, nullsFirst: false })
    .order("reference", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<Passage[]>();

  const passages = sortPassagesByReference(rawPassages ?? []);

  const { data: images } = await supabase
    .from("manuscript_images")
    .select("*")
    .eq("manuscript_id", id)
    .order("page_number", { ascending: true })
    .returns<ManuscriptImage[]>();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <ManuscriptDetail
      manuscript={manuscript}
      passages={passages ?? []}
      images={images ?? []}
      isAuthenticated={!!user}
    />
  );
}
