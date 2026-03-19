import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { GrandAssessmentPanel } from "./grand-assessment-panel";

export const metadata: Metadata = {
  title: "Corpus Insights — CodexAtlas",
  description:
    "AI-synthesized analysis of the CodexAtlas manuscript corpus — book summaries, textual patterns, and a grand unified assessment.",
};

interface AiSummaryRow {
  level: string;
  scope_key: string;
  content: Record<string, unknown>;
  model: string;
  generated_at: string;
  version: number;
}

interface BookSummaryContent {
  overview: string;
  structure: string;
  theological_themes: string[];
  manuscript_tradition: string;
  scholarly_significance: string;
}

interface GrandAssessmentContent {
  narrative: string;
  confidence_trends: string;
  variant_patterns: string;
  cross_manuscript_insights: string;
  areas_of_certainty: string[];
  areas_of_uncertainty: string[];
}

export default async function InsightsPage() {
  const admin = createAdminClient();

  const [{ data: bookRows }, { data: grandRow }] = await Promise.all([
    admin
      .from("ai_summaries")
      .select("level, scope_key, content, model, generated_at, version")
      .eq("level", "book")
      .order("scope_key")
      .returns<AiSummaryRow[]>(),
    admin
      .from("ai_summaries")
      .select("level, scope_key, content, model, generated_at, version")
      .eq("level", "grand")
      .eq("scope_key", "grand")
      .single<AiSummaryRow>(),
  ]);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single<{ role: string }>();
    isAdmin = ["admin", "editor"].includes(profile?.role ?? "");
  }

  const grandAssessment = grandRow?.content as GrandAssessmentContent | null | undefined;
  const books = bookRows ?? [];

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-gray-900">Corpus Insights</h1>
        <p className="mt-2 text-sm text-gray-500">
          AI-synthesized analysis across all manuscripts, books, and chapters in CodexAtlas.
        </p>
      </div>

      {/* Grand Assessment */}
      <section className="mb-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-gray-800">
            Grand Unified Assessment
          </h2>
          {isAdmin && (
            <GrandAssessmentPanel
              hasExisting={!!grandAssessment}
              generatedAt={grandRow?.generated_at ?? null}
              version={grandRow?.version ?? null}
            />
          )}
        </div>

        {grandAssessment ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700 ring-1 ring-inset ring-amber-300">
                {grandRow?.model}
              </span>
              {grandRow?.generated_at && (
                <span className="text-xs text-gray-400">
                  Generated {new Date(grandRow.generated_at).toLocaleDateString()}
                  {grandRow.version && grandRow.version > 1 ? ` · v${grandRow.version}` : ""}
                </span>
              )}
            </div>

            <p className="mb-4 text-sm leading-relaxed text-gray-700 whitespace-pre-line">
              {grandAssessment.narrative}
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {grandAssessment.confidence_trends && (
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Confidence Trends
                  </h3>
                  <p className="text-xs leading-relaxed text-gray-600">
                    {grandAssessment.confidence_trends}
                  </p>
                </div>
              )}
              {grandAssessment.variant_patterns && (
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Variant Patterns
                  </h3>
                  <p className="text-xs leading-relaxed text-gray-600">
                    {grandAssessment.variant_patterns}
                  </p>
                </div>
              )}
              {grandAssessment.cross_manuscript_insights && (
                <div className="sm:col-span-2">
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Cross-Manuscript Insights
                  </h3>
                  <p className="text-xs leading-relaxed text-gray-600">
                    {grandAssessment.cross_manuscript_insights}
                  </p>
                </div>
              )}
            </div>

            {(grandAssessment.areas_of_certainty?.length > 0 ||
              grandAssessment.areas_of_uncertainty?.length > 0) && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {grandAssessment.areas_of_certainty?.length > 0 && (
                  <div>
                    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-green-700">
                      Areas of Certainty
                    </h3>
                    <ul className="space-y-1">
                      {grandAssessment.areas_of_certainty.map((item, i) => (
                        <li key={i} className="flex gap-1.5 text-xs text-gray-600">
                          <span className="mt-0.5 shrink-0 text-green-500">·</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {grandAssessment.areas_of_uncertainty?.length > 0 && (
                  <div>
                    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
                      Areas of Uncertainty
                    </h3>
                    <ul className="space-y-1">
                      {grandAssessment.areas_of_uncertainty.map((item, i) => (
                        <li key={i} className="flex gap-1.5 text-xs text-gray-600">
                          <span className="mt-0.5 shrink-0 text-amber-500">·</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
            <p className="text-sm text-gray-500">
              No grand assessment yet.
              {isAdmin
                ? " Use the button above to generate one."
                : " An admin will generate this soon."}
            </p>
          </div>
        )}
      </section>

      {/* Book Summaries */}
      <section>
        <h2 className="mb-4 font-serif text-xl font-semibold text-gray-800">
          Book Summaries
          <span className="ml-2 text-sm font-normal text-gray-400">({books.length})</span>
        </h2>

        {books.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
            <p className="text-sm text-gray-500">
              No book summaries yet. Generate them from individual book pages.
            </p>
            <Link
              href="/read"
              className="mt-3 inline-block text-sm text-primary-700 hover:underline"
            >
              Browse books &rarr;
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {books.map((row) => {
              const content = row.content as unknown as BookSummaryContent;
              return (
                <div
                  key={row.scope_key}
                  className="rounded-xl border border-gray-200 bg-white p-5"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <Link
                      href={`/read/${encodeURIComponent(row.scope_key)}/1`}
                      className="font-serif text-base font-semibold text-gray-900 hover:text-primary-700"
                    >
                      {row.scope_key}
                    </Link>
                    <span className="shrink-0 text-xs text-gray-400">
                      {new Date(row.generated_at).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="mb-3 text-sm leading-relaxed text-gray-600">{content.overview}</p>

                  {content.theological_themes?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {content.theological_themes.slice(0, 5).map((theme) => (
                        <span
                          key={theme}
                          className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600"
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
