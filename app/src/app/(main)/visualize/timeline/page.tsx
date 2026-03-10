import Link from "next/link";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { TimelineView } from "./timeline-view";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Manuscript Timeline — CodexAtlas",
  description: "Explore manuscripts plotted across history by estimated date of creation.",
};

interface ManuscriptPoint {
  id: string;
  title: string;
  language: string;
  dateStart: number | null;
  dateEnd: number | null;
  passageCount: number;
}

export default async function TimelinePage() {
  const admin = createAdminClient();

  const { data: manuscripts } = await admin
    .from("manuscripts")
    .select("id, title, original_language, estimated_date_start, estimated_date_end")
    .is("archived_at", null)
    .not("estimated_date_start", "is", null)
    .order("estimated_date_start", { ascending: true });

  const msIds = (manuscripts ?? []).map((m) => m.id);

  const { data: passageCounts } = msIds.length
    ? await admin
        .from("passages")
        .select("manuscript_id")
        .in("manuscript_id", msIds)
    : { data: [] };

  const countMap = new Map<string, number>();
  for (const p of passageCounts ?? []) {
    countMap.set(p.manuscript_id, (countMap.get(p.manuscript_id) ?? 0) + 1);
  }

  const points: ManuscriptPoint[] = (manuscripts ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    language: m.original_language,
    dateStart: m.estimated_date_start,
    dateEnd: m.estimated_date_end,
    passageCount: countMap.get(m.id) ?? 0,
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <nav className="mb-6 text-sm text-gray-500">
        <Link href="/visualize" className="hover:text-primary-700">Visualize</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">Timeline</span>
      </nav>

      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-primary-900">
          Manuscript Timeline
        </h1>
        <p className="mt-1 text-gray-600">
          {points.length} manuscript{points.length !== 1 ? "s" : ""} plotted across history by estimated date.
        </p>
      </div>

      {points.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">
          No manuscripts with date estimates available yet.
        </p>
      ) : (
        <TimelineView manuscripts={points} />
      )}
    </div>
  );
}
