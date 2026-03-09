import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ManuscriptList } from "./manuscript-list";
import type { Manuscript } from "@/lib/types";

export const metadata = {
  title: "Manuscripts — CodexAtlas",
  description: "Browse ancient manuscripts in the CodexAtlas collection.",
};

export default async function ManuscriptsPage() {
  const supabase = await createClient();

  const { data: manuscripts } = await supabase
    .from("manuscripts")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .returns<Manuscript[]>();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary-900">
            Manuscripts
          </h1>
          <p className="mt-1 text-gray-600">
            Browse and explore ancient manuscript records.
          </p>
        </div>
        {user && (
          <Link
            href="/manuscripts/new"
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
            Add Manuscript
          </Link>
        )}
      </div>

      <ManuscriptList manuscripts={manuscripts ?? []} />
    </div>
  );
}
