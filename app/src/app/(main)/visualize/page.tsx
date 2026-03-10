import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Visualize — CodexAtlas",
  description: "Interactive visualizations of manuscript data: timeline, geographic map, and textual family tree.",
};

const VISUALIZATIONS = [
  {
    href: "/visualize/timeline",
    title: "Manuscript Timeline",
    description:
      "Plot manuscripts across history by their estimated date of creation. See how texts span centuries and explore the chronological landscape of ancient manuscript production.",
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
  },
  {
    href: "/visualize/map",
    title: "Geographic Provenance Map",
    description:
      "See where manuscripts were created and where they are archived today. Explore the geographic spread of textual traditions from Egypt to Europe.",
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
      </svg>
    ),
  },
  {
    href: "/visualize/stemma",
    title: "Textual Family Tree",
    description:
      "Explore how manuscripts relate to each other through copy, derivative, and shared-source relationships. Visualize textual transmission as a directed graph.",
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
      </svg>
    ),
  },
];

export default function VisualizePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-bold text-primary-900">
          Visualize
        </h1>
        <p className="mt-2 text-gray-600">
          Interactive visualizations of manuscript data — explore manuscripts across time,
          geography, and textual tradition.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {VISUALIZATIONS.map((viz) => (
          <Link
            key={viz.href}
            href={viz.href}
            className="group flex flex-col rounded-xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-lg"
          >
            <div className="mb-4 text-primary-600 transition-colors group-hover:text-primary-700">
              {viz.icon}
            </div>
            <h2 className="font-serif text-lg font-semibold text-gray-900 group-hover:text-primary-700">
              {viz.title}
            </h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600">
              {viz.description}
            </p>
            <span className="mt-4 text-sm font-medium text-primary-700 group-hover:underline">
              Explore &rarr;
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
