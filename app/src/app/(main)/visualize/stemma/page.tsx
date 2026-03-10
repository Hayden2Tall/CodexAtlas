import Link from "next/link";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { StemmaView } from "./stemma-view";

export const metadata: Metadata = {
  title: "Textual Family Tree — CodexAtlas",
  description: "Explore manuscript lineage relationships and textual transmission history.",
};

interface LineageRow {
  id: string;
  parent_manuscript_id: string;
  child_manuscript_id: string;
  relationship_type: string;
  confidence_score: number | null;
  parent: { id: string; title: string; estimated_date_start: number | null };
  child: { id: string; title: string; estimated_date_start: number | null };
}

export default async function StemmaPage() {
  const admin = createAdminClient();

  const { data: lineage } = await admin
    .from("manuscript_lineage")
    .select(`
      id, parent_manuscript_id, child_manuscript_id, relationship_type, confidence_score,
      parent:manuscripts!manuscript_lineage_parent_manuscript_id_fkey(id, title, estimated_date_start),
      child:manuscripts!manuscript_lineage_child_manuscript_id_fkey(id, title, estimated_date_start)
    `)
    .returns<LineageRow[]>();

  const edges = (lineage ?? []).map((l) => ({
    id: l.id,
    parentId: l.parent_manuscript_id,
    parentTitle: (l.parent as unknown as { title: string })?.title ?? "Unknown",
    parentDate: (l.parent as unknown as { estimated_date_start: number | null })?.estimated_date_start ?? null,
    childId: l.child_manuscript_id,
    childTitle: (l.child as unknown as { title: string })?.title ?? "Unknown",
    childDate: (l.child as unknown as { estimated_date_start: number | null })?.estimated_date_start ?? null,
    type: l.relationship_type,
    confidence: l.confidence_score,
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <nav className="mb-6 text-sm text-gray-500">
        <Link href="/visualize" className="hover:text-primary-700">Visualize</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">Family Tree</span>
      </nav>

      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-primary-900">
          Textual Family Tree
        </h1>
        <p className="mt-1 text-gray-600">
          Visualize manuscript lineage relationships and textual transmission paths.
        </p>
      </div>

      {edges.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 px-6 py-16 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
          </svg>
          <h2 className="mt-4 text-lg font-semibold text-gray-600">
            No Lineage Data Yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
            Manuscript lineage relationships have not been established yet. When parent-child
            relationships between manuscripts are identified (copy, derivative, shared source,
            or hypothetical connections), they will appear here as an interactive family tree.
          </p>
          <p className="mx-auto mt-4 max-w-md text-xs text-gray-400">
            Lineage data can be added via the manuscript_lineage table. Relationship types
            include: <span className="font-medium">copy</span>, <span className="font-medium">derivative</span>,
            <span className="font-medium">shared_source</span>, and <span className="font-medium">hypothetical</span>.
          </p>
        </div>
      ) : (
        <StemmaView edges={edges} />
      )}
    </div>
  );
}
