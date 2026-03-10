import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ManuscriptDetail } from "./manuscript-detail";
import type { Manuscript, Passage, ManuscriptImage } from "@/lib/types";

interface ManuscriptPageProps {
  params: Promise<{ id: string }>;
}

const BOOK_ORDER: Record<string, number> = {
  genesis: 1, exodus: 2, leviticus: 3, numbers: 4, deuteronomy: 5,
  joshua: 6, judges: 7, ruth: 8, "1 samuel": 9, "2 samuel": 10,
  "1 kings": 11, "2 kings": 12, "1 chronicles": 13, "2 chronicles": 14,
  ezra: 15, nehemiah: 16, esther: 17, job: 18, psalms: 19, psalm: 19,
  proverbs: 20, ecclesiastes: 21, "song of solomon": 22, "song of songs": 22, canticles: 22, isaiah: 23,
  jeremiah: 24, lamentations: 25, ezekiel: 26, daniel: 27, hosea: 28,
  joel: 29, amos: 30, obadiah: 31, jonah: 32, micah: 33, nahum: 34,
  habakkuk: 35, zephaniah: 36, haggai: 37, zechariah: 38, malachi: 39,
  matthew: 40, mark: 41, luke: 42, john: 43, acts: 44, romans: 45,
  "1 corinthians": 46, "2 corinthians": 47, galatians: 48, ephesians: 49,
  philippians: 50, colossians: 51, "1 thessalonians": 52, "2 thessalonians": 53,
  "1 timothy": 54, "2 timothy": 55, titus: 56, philemon: 57, hebrews: 58,
  james: 59, "1 peter": 60, "2 peter": 61, "1 john": 62, "2 john": 63,
  "3 john": 64, jude: 65, revelation: 66,
  // Deuterocanonical / Apocrypha (67+)
  "1 esdras": 67, "3 ezra": 67, "esdras a": 67,
  tobit: 68,
  judith: 69,
  wisdom: 70, "wisdom of solomon": 70,
  sirach: 71, ecclesiasticus: 71, "wisdom of sirach": 71, "ben sira": 71,
  baruch: 73, "letter of jeremiah": 73, "epistle of jeremiah": 73,
  "1 maccabees": 74, "2 maccabees": 75, "3 maccabees": 76, "4 maccabees": 80,
  susanna: 78, "bel and the dragon": 79, "prayer of azariah": 77, "song of the three young men": 77,
  "psalms of solomon": 85, "odæs": 86, odes: 86, "ode": 86,
  // Ethiopian canon (100+)
  "1 enoch": 100, enoch: 100,
  jubilees: 101,
  "1 meqabyan": 102, "2 meqabyan": 103, "3 meqabyan": 104,
  "rest of words of baruch": 105, "4 baruch": 105,
  "4 ezra": 106, "2 esdras": 106, "2 esdras (latin)": 106,
  // Other ancient texts (150+)
  "prayer of manasseh": 150, "prayer of manasses": 150,
};

function parseRef(ref: string): [number, number] {
  const match = ref.match(/^(.+?)\s+(\d+)/);
  if (!match) return [999, 0];
  const book = BOOK_ORDER[match[1].toLowerCase().trim()] ?? 999;
  return [book, parseInt(match[2], 10)];
}

function sortPassagesByReference(passages: Passage[]): Passage[] {
  return [...passages].sort((a, b) => {
    if (a.sequence_order != null && b.sequence_order != null) {
      return a.sequence_order - b.sequence_order;
    }
    const [aBook, aCh] = parseRef(a.reference);
    const [bBook, bCh] = parseRef(b.reference);
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
