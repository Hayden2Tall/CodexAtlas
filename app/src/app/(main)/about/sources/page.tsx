import type { Metadata } from "next";
import Link from "next/link";
import { SOURCE_REGISTRY } from "@/lib/utils/source-registry";

export const metadata: Metadata = {
  title: "Sources & Attribution — CodexAtlas",
  description:
    "Open-access manuscript corpora used by CodexAtlas, with license information and source attribution.",
};

const LANGUAGE_LABELS: Record<string, string> = {
  heb: "Hebrew",
  grc: "Greek",
  cop: "Coptic",
  lat: "Latin",
  syc: "Syriac",
};

const COVERAGE_LABELS: Record<string, string> = {
  ot: "Old Testament",
  nt: "New Testament",
  full: "Full Bible",
  patristic: "Patristic / Early Church",
  mixed: "Mixed",
};

const LICENSE_COLORS: Record<string, string> = {
  "Public domain": "bg-green-50 text-green-700 ring-green-200",
  "CC BY 4.0": "bg-blue-50 text-blue-700 ring-blue-200",
  "CC BY-NC 4.0": "bg-amber-50 text-amber-700 ring-amber-200",
  "CC BY-NC-SA 3.0": "bg-amber-50 text-amber-700 ring-amber-200",
  "CC-BY or equivalent per work": "bg-blue-50 text-blue-700 ring-blue-200",
};

export default function SourcesPage() {
  const sources = Object.values(SOURCE_REGISTRY);

  return (
    <div className="mx-auto max-w-3xl">
      <nav className="mb-6 text-sm text-gray-500">
        <Link href="/" className="hover:text-primary-600">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">Sources &amp; Attribution</span>
      </nav>

      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-gray-900">
          Sources &amp; Attribution
        </h1>
        <p className="mt-2 text-gray-600">
          CodexAtlas uses open-access manuscript corpora. All texts are used
          under their respective licenses. Accepting donations covers
          infrastructure costs only and does not grant any license to the
          underlying texts.
        </p>
      </div>

      <div className="space-y-4">
        {sources.map((source) => {
          const licenseColor =
            LICENSE_COLORS[source.license] ??
            "bg-gray-50 text-gray-700 ring-gray-200";

          return (
            <div
              key={source.id}
              className="rounded-xl border border-gray-200 bg-white p-5"
            >
              <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-serif text-lg font-semibold text-gray-900">
                    {source.displayName}
                  </h2>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {LANGUAGE_LABELS[source.language] ?? source.language}
                    {" · "}
                    {COVERAGE_LABELS[source.coverage] ?? source.coverage}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${licenseColor}`}
                >
                  {source.license}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {source.manuscriptNames.map((name) => (
                  <span
                    key={name}
                    className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                  >
                    {name}
                  </span>
                ))}
              </div>

              <div className="mt-3 text-xs text-gray-500">
                <a
                  href={source.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:underline"
                >
                  {source.downloadUrl}
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10 rounded-xl border border-amber-100 bg-amber-50 p-5">
        <h2 className="mb-2 font-semibold text-amber-900">License notice</h2>
        <p className="text-sm leading-relaxed text-amber-800">
          Non-commercial licenses (CC BY-NC) permit use for research and
          educational purposes but prohibit selling or commercially exploiting
          the content. Donations accepted by CodexAtlas cover operational costs
          (hosting, AI API usage, domain) and do not constitute commercial use
          of the underlying texts. If you have licensing questions, consult a
          qualified attorney.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-amber-800">
          AI-generated translations produced by CodexAtlas are derived from
          these source texts. Their licensing status follows the license of the
          source text they were generated from.
        </p>
      </div>
    </div>
  );
}
