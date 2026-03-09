import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import type { Variant } from "@/lib/types";

export const metadata = {
  title: "Textual Variants — CodexAtlas",
  description: "Browse and compare textual variants across manuscripts.",
};

export default async function VariantsPage() {
  const supabase = await createClient();

  const { data: variants } = await supabase
    .from("variants")
    .select("*, variant_readings(id)")
    .order("passage_reference", { ascending: true })
    .returns<(Variant & { variant_readings: { id: string }[] })[]>();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const grouped = new Map<
    string,
    {
      id: string;
      passage_reference: string;
      description: string | null;
      readingCount: number;
      created_at: string;
    }[]
  >();

  for (const v of variants ?? []) {
    const ref = v.passage_reference;
    const entry = {
      id: v.id,
      passage_reference: ref,
      description: v.description,
      readingCount: Array.isArray(v.variant_readings)
        ? v.variant_readings.length
        : 0,
      created_at: v.created_at,
    };
    const group = grouped.get(ref);
    if (group) {
      group.push(entry);
    } else {
      grouped.set(ref, [entry]);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary-900">
            Textual Variants
          </h1>
          <p className="mt-1 text-gray-600">
            Compare manuscript readings across textual variants.
          </p>
        </div>
        {user && (
          <Link
            href="/variants/new"
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
            Add Variant
          </Link>
        )}
      </div>

      {!variants?.length ? (
        <EmptyState
          title="No variants yet"
          description="Create a textual variant to begin comparing readings across manuscripts."
          action={{ label: "Add Variant", href: "/variants/new" }}
        />
      ) : (
        <div className="space-y-8">
          {[...grouped.entries()].map(([ref, items]) => (
            <section key={ref}>
              <h2 className="mb-3 border-b border-gray-200 pb-2 font-serif text-lg font-semibold text-gray-800">
                {ref}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((v) => (
                  <Link
                    key={v.id}
                    href={`/variants/${v.id}`}
                    className="group rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-sm font-medium text-gray-900 group-hover:text-primary-700">
                        {v.description || "Untitled variant"}
                      </p>
                      <span className="ml-2 shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {v.readingCount}{" "}
                        {v.readingCount === 1 ? "reading" : "readings"}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500">
                      {v.passage_reference}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
