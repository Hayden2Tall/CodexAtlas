import Link from "next/link";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { MapView } from "./map-view";

export const metadata: Metadata = {
  title: "Geographic Provenance Map — CodexAtlas",
  description: "Explore where manuscripts were created and where they are archived today.",
};

interface MapManuscript {
  id: string;
  title: string;
  language: string;
  originLocation: string | null;
  archiveLocation: string | null;
  dateStart: number | null;
  dateEnd: number | null;
}

export default async function MapPage() {
  const admin = createAdminClient();

  const { data: manuscripts } = await admin
    .from("manuscripts")
    .select("id, title, original_language, origin_location, archive_location, estimated_date_start, estimated_date_end")
    .is("archived_at", null);

  const items: MapManuscript[] = (manuscripts ?? [])
    .filter((m) => m.origin_location || m.archive_location)
    .map((m) => ({
      id: m.id,
      title: m.title,
      language: m.original_language,
      originLocation: m.origin_location,
      archiveLocation: m.archive_location,
      dateStart: m.estimated_date_start,
      dateEnd: m.estimated_date_end,
    }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <nav className="mb-6 text-sm text-gray-500">
        <Link href="/visualize" className="hover:text-primary-700">Visualize</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">Geographic Map</span>
      </nav>

      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-primary-900">
          Geographic Provenance Map
        </h1>
        <p className="mt-1 text-gray-600">
          {items.length} manuscript{items.length !== 1 ? "s" : ""} with location data.
          Showing origin and current archive locations.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">
          No manuscripts with location data available yet.
        </p>
      ) : (
        <MapView manuscripts={items} />
      )}
    </div>
  );
}
