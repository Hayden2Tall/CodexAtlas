import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Logo } from "@/components/brand/logo";
import { createAdminClient } from "@/lib/supabase/admin";

interface StatsData {
  manuscripts: number;
  passages: number;
  translations: number;
  languages: number;
}

interface FeaturedManuscript {
  id: string;
  title: string;
  original_language: string;
  estimated_date_start: number | null;
  estimated_date_end: number | null;
  description: string | null;
}

interface RecentTranslation {
  id: string;
  snippet: string;
  confidence_score: number | null;
  passage_reference: string;
  passage_id: string;
  manuscript_id: string;
  manuscript_title: string;
}

async function loadHomeData(): Promise<{
  stats: StatsData;
  featured: FeaturedManuscript[];
  recent: RecentTranslation[];
}> {
  try {
    const admin = createAdminClient();

    const [mCount, pCount, tCount, langs] = await Promise.all([
      admin.from("manuscripts").select("id", { count: "exact", head: true }).is("archived_at", null),
      admin.from("passages").select("id", { count: "exact", head: true }).not("original_text", "is", null),
      admin.from("translation_versions").select("id", { count: "exact", head: true }).eq("status", "published"),
      admin.from("manuscripts").select("original_language").is("archived_at", null),
    ]);

    const uniqueLangs = new Set((langs.data ?? []).map((m) => m.original_language));

    const { data: featured } = await admin
      .from("manuscripts")
      .select("id, title, original_language, estimated_date_start, estimated_date_end, description")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(3);

    const { data: recentVersions } = await admin
      .from("translation_versions")
      .select(`
        id, translated_text, confidence_score,
        translations!inner(id, passage_id, target_language,
          passages!inner(id, reference, manuscript_id,
            manuscripts!inner(id, title)
          )
        )
      `)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(5);

    const recent: RecentTranslation[] = (recentVersions ?? []).map((tv) => {
      const t = tv.translations as unknown as {
        id: string;
        target_language: string;
        passages: {
          id: string;
          reference: string;
          manuscript_id: string;
          manuscripts: { id: string; title: string };
        };
      };
      return {
        id: tv.id,
        snippet: tv.translated_text?.slice(0, 180) ?? "",
        confidence_score: tv.confidence_score,
        passage_reference: t.passages.reference,
        passage_id: t.passages.id,
        manuscript_id: t.passages.manuscript_id,
        manuscript_title: t.passages.manuscripts.title,
      };
    });

    return {
      stats: {
        manuscripts: mCount.count ?? 0,
        passages: pCount.count ?? 0,
        translations: tCount.count ?? 0,
        languages: uniqueLangs.size,
      },
      featured: (featured ?? []) as FeaturedManuscript[],
      recent,
    };
  } catch {
    return {
      stats: { manuscripts: 0, passages: 0, translations: 0, languages: 0 },
      featured: [],
      recent: [],
    };
  }
}

function formatDate(start: number | null, end: number | null): string {
  const fmt = (y: number) => (y < 0 ? `${Math.abs(y)} BCE` : `${y} CE`);
  if (start != null && end != null) return `${fmt(start)}–${fmt(end)}`;
  if (start != null) return fmt(start);
  if (end != null) return fmt(end);
  return "";
}

const DISCOVERY_PATHS = [
  {
    title: "Earliest New Testament Manuscripts",
    description: "Explore the oldest surviving witnesses to the New Testament text, from 2nd-century papyri to great uncial codices.",
    href: "/manuscripts",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    ),
  },
  {
    title: "Dead Sea Scrolls Collection",
    description: "Discover the ancient Hebrew texts found near Qumran, including biblical and sectarian manuscripts.",
    href: "/manuscripts",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    ),
  },
  {
    title: "The Septuagint (LXX)",
    description: "The ancient Greek translation of the Hebrew Bible, foundational for early Christianity and still used in Orthodox churches.",
    href: "/manuscripts",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
    ),
  },
];

export default async function Home() {
  const { stats, featured, recent } = await loadHomeData();
  const hasContent = stats.manuscripts > 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-4 py-20 md:py-28 text-center">
          <Logo size={56} className="mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 font-serif leading-tight">
            Ancient Manuscripts,
            <br />
            <span className="text-primary-700">Transparent Research</span>
          </h1>
          <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Discover, analyze, translate, and compare ancient religious
            manuscripts. Every AI translation includes its evidence chain.
            Nothing is hidden.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/read"
              className="px-8 py-3 bg-primary-700 text-white rounded-lg font-medium hover:bg-primary-800 transition-colors"
            >
              Browse Scripture
            </Link>
            <Link
              href="/manuscripts"
              className="px-8 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:border-gray-400 transition-colors"
            >
              Explore Manuscripts
            </Link>
          </div>
        </section>

        {/* Stats bar */}
        {hasContent && (
          <section className="border-y border-gray-100 bg-primary-50/30">
            <div className="mx-auto max-w-4xl px-4 py-8">
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                <StatBlock label="Manuscripts" value={stats.manuscripts} />
                <StatBlock label="Passages" value={stats.passages} />
                <StatBlock label="Translations" value={stats.translations} />
                <StatBlock label="Languages" value={stats.languages} />
              </div>
            </div>
          </section>
        )}

        {/* Feature cards */}
        <section className="border-b border-gray-100 bg-gray-50">
          <div className="mx-auto max-w-5xl px-4 py-16">
            <div className="grid md:grid-cols-3 gap-8">
              <FeatureCard
                title="Transparent Translations"
                description="Every translation includes confidence scores, source manuscripts, methods, and full version history."
                icon={
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
                }
                color="primary"
              />
              <FeatureCard
                title="Evidence-Based"
                description='Every conclusion links to its evidence chain. Tap "How do we know this?" on any result.'
                icon={
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                }
                color="secondary"
              />
              <FeatureCard
                title="Version History"
                description="Nothing is deleted. Every version of every translation is preserved and accessible."
                icon={
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                }
                color="green"
              />
            </div>
          </div>
        </section>

        {/* Featured manuscripts */}
        {featured.length > 0 && (
          <section className="border-b border-gray-100">
            <div className="mx-auto max-w-5xl px-4 py-16">
              <div className="mb-8 flex items-end justify-between">
                <div>
                  <h2 className="font-serif text-2xl font-bold text-gray-900">
                    Featured Manuscripts
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Recently added to the corpus
                  </p>
                </div>
                <Link
                  href="/manuscripts"
                  className="text-sm font-medium text-primary-700 hover:underline"
                >
                  View all &rarr;
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {featured.map((ms) => (
                  <Link
                    key={ms.id}
                    href={`/manuscripts/${ms.id}`}
                    className="group rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
                  >
                    <h3 className="font-serif text-lg font-semibold text-gray-900 group-hover:text-primary-700">
                      {ms.title}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span className="rounded-full bg-primary-50 px-2 py-0.5 font-medium text-primary-700">
                        {ms.original_language.toUpperCase()}
                      </span>
                      {(ms.estimated_date_start || ms.estimated_date_end) && (
                        <span>{formatDate(ms.estimated_date_start, ms.estimated_date_end)}</span>
                      )}
                    </div>
                    {ms.description && (
                      <p className="mt-3 line-clamp-2 text-sm text-gray-600">
                        {ms.description}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Recent translations */}
        {recent.length > 0 && (
          <section className="border-b border-gray-100 bg-gray-50">
            <div className="mx-auto max-w-5xl px-4 py-16">
              <div className="mb-8">
                <h2 className="font-serif text-2xl font-bold text-gray-900">
                  Recent Translations
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Latest published translations with evidence chains
                </p>
              </div>
              <div className="space-y-3">
                {recent.map((t) => (
                  <Link
                    key={t.id}
                    href={`/manuscripts/${t.manuscript_id}/passages/${t.passage_id}/translate`}
                    className="group flex gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-900 group-hover:text-primary-700">
                          {t.passage_reference}
                        </span>
                        <span className="text-xs text-gray-400">
                          {t.manuscript_title}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                        {t.snippet}{t.snippet.length >= 180 ? "..." : ""}
                      </p>
                    </div>
                    {t.confidence_score != null && (
                      <div className="shrink-0 self-center">
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700">
                          {Math.round(t.confidence_score * 100)}%
                        </span>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Discovery paths */}
        <section className="border-b border-gray-100">
          <div className="mx-auto max-w-5xl px-4 py-16">
            <div className="mb-8 text-center">
              <h2 className="font-serif text-2xl font-bold text-gray-900">
                Discover
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Guided paths into the world of ancient manuscripts
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {DISCOVERY_PATHS.map((path) => (
                <Link
                  key={path.title}
                  href={path.href}
                  className="group rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      {path.icon}
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-primary-700">
                    {path.title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {path.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-500">
        <p>CodexAtlas — Open Research Platform for Ancient Manuscripts</p>
        <p className="mt-1">
          Open source &middot;{" "}
          <a
            href="https://github.com/Hayden2Tall/CodexAtlas"
            className="underline hover:text-gray-700"
          >
            GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-primary-700">{value.toLocaleString()}</div>
      <div className="mt-0.5 text-xs font-medium text-gray-500">{label}</div>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  icon,
  color,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: "primary" | "secondary" | "green";
}) {
  const colorClasses = {
    primary: "bg-primary-100 text-primary-700",
    secondary: "bg-secondary-100 text-secondary-700",
    green: "bg-green-100 text-green-700",
  };

  return (
    <div className="text-center">
      <div
        className={`w-12 h-12 ${colorClasses[color]} rounded-xl flex items-center justify-center mx-auto`}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          {icon}
        </svg>
      </div>
      <h3 className="mt-4 font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-600">{description}</p>
    </div>
  );
}
