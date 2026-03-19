import Link from "next/link";
import { Header } from "@/components/layout/header";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
      </main>
      <footer className="border-t border-gray-100 py-4">
        <div className="mx-auto max-w-7xl px-4 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
          <span>CodexAtlas — open-access manuscript research</span>
          <nav className="flex gap-4">
            <Link href="/about/sources" className="hover:text-gray-600">
              Sources &amp; Attribution
            </Link>
            <Link href="/read" className="hover:text-gray-600">
              Manuscript Library
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
