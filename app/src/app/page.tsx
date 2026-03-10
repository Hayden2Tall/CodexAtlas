import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Logo } from "@/components/brand/logo";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
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
              href="/manuscripts"
              className="px-8 py-3 bg-primary-700 text-white rounded-lg font-medium hover:bg-primary-800 transition-colors"
            >
              Explore Manuscripts
            </Link>
            <Link
              href="/search"
              className="px-8 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:border-gray-400 transition-colors"
            >
              Search the Corpus
            </Link>
          </div>
        </section>

        <section className="border-t border-gray-100 bg-gray-50">
          <div className="mx-auto max-w-5xl px-4 py-16">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-12 h-12 bg-primary-100 text-primary-700 rounded-xl flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
                  </svg>
                </div>
                <h3 className="mt-4 font-semibold text-gray-900">
                  Transparent Translations
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  Every translation includes confidence scores, source
                  manuscripts, methods, and full version history.
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-secondary-100 text-secondary-700 rounded-xl flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <h3 className="mt-4 font-semibold text-gray-900">
                  Evidence-Based
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  Every conclusion links to its evidence chain. Tap &ldquo;How
                  do we know this?&rdquo; on any result.
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 text-green-700 rounded-xl flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="mt-4 font-semibold text-gray-900">
                  Version History
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  Nothing is deleted. Every version of every translation is
                  preserved and accessible.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-500">
        <p>CodexAtlas — Open Research Platform for Ancient Manuscripts</p>
        <p className="mt-1">
          Open source ·{" "}
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
