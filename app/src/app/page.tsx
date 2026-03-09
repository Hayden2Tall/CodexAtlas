import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-primary-700 font-serif">
              CodexAtlas
            </span>
            <span className="text-xs bg-secondary-100 text-secondary-700 px-2 py-0.5 rounded-full font-medium">
              Alpha
            </span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/manuscripts"
              className="text-sm text-gray-600 hover:text-primary-700 transition-colors"
            >
              Manuscripts
            </Link>
            <Link
              href="/auth/login"
              className="text-sm bg-primary-700 text-white px-4 py-2 rounded-lg hover:bg-primary-800 transition-colors"
            >
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-4 py-24 text-center">
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
              href="/about"
              className="px-8 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:border-gray-400 transition-colors"
            >
              How It Works
            </Link>
          </div>
        </section>

        <section className="border-t border-gray-100 bg-gray-50">
          <div className="mx-auto max-w-5xl px-4 py-16">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-12 h-12 bg-primary-100 text-primary-700 rounded-xl flex items-center justify-center mx-auto text-xl font-bold">
                  T
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
                <div className="w-12 h-12 bg-secondary-100 text-secondary-700 rounded-xl flex items-center justify-center mx-auto text-xl font-bold">
                  E
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
                <div className="w-12 h-12 bg-green-100 text-green-700 rounded-xl flex items-center justify-center mx-auto text-xl font-bold">
                  V
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
            href="https://github.com/codexatlas"
            className="underline hover:text-gray-700"
          >
            GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}
