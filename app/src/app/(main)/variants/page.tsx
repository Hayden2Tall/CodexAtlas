import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import { parseReference, getBookDisplayName } from "@/lib/utils/book-order";
import type { Variant } from "@/lib/types";
import { VariantFilters } from "./variant-filters";

export const metadata = {
  title: "Textual Variants — CodexAtlas",
  description: "Browse and compare textual variants across manuscripts.",
};

interface VariantRow extends Variant {
  variant_readings: { id: string }[];
}

interface GroupedBook {
  bookName: string;
  order: number;
  variants: {
    id: string;
    passage_reference: string;
    description: string | null;
    readingCount: number;
    significance: string;
    created_at: string;
  }[];
}

export default async function VariantsPage() {
  const supabase = await createClient();

  const { data: variants } = await supabase
    .from("variants")
    .select("*, variant_readings(id)")
    .order("passage_reference", { ascending: true })
    .returns<VariantRow[]>();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const bookMap = new Map<number, GroupedBook>();

  for (const v of variants ?? []) {
    const [order] = parseReference(v.passage_reference);
    const sig = (v.metadata as Record<string, unknown> | null)?.significance;

    let group = bookMap.get(order);
    if (!group) {
      const bookName = v.passage_reference.replace(/\s+\d+.*$/, "").trim();
      group = {
        bookName: order < 999 ? getBookDisplayName(bookName) : bookName,
        order,
        variants: [],
      };
      bookMap.set(order, group);
    }

    group.variants.push({
      id: v.id,
      passage_reference: v.passage_reference,
      description: v.description,
      readingCount: Array.isArray(v.variant_readings)
        ? v.variant_readings.length
        : 0,
      significance: typeof sig === "string" ? sig : "minor",
      created_at: v.created_at,
    });
  }

  const books = [...bookMap.values()].sort((a, b) => a.order - b.order);

  const allVariants = books.flatMap((b) =>
    b.variants.map((v) => ({ ...v, bookName: b.bookName, bookOrder: b.order }))
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary-900">
            Textual Variants
          </h1>
          <p className="mt-1 text-gray-600">
            Browse and compare manuscript readings across textual variants.
          </p>
        </div>
        {user && (
          <Link
            href="/variants/new"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Variant
          </Link>
        )}
      </div>

      {!variants?.length ? (
        <EmptyState
          title="No variants yet"
          description="Detect textual variants by comparing passages from different manuscripts."
          action={{ label: "Add Variant", href: "/variants/new" }}
        />
      ) : (
        <VariantFilters variants={allVariants} />
      )}
    </div>
  );
}
