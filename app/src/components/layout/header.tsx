"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MobileNav } from "./mobile-nav";
import { Logo } from "@/components/brand/logo";
import type { User } from "@supabase/supabase-js";

const navLinks = [
  { href: "/read", label: "Read" },
  { href: "/manuscripts", label: "Manuscripts" },
  { href: "/search", label: "Search" },
  { href: "/admin", label: "Admin" },
] as const;

export function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;

    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setDropdownOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 py-3">
          {/* Left: hamburger + logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 md:hidden"
              aria-label="Open menu"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
            </button>

            <Link href="/" className="flex items-center gap-2.5">
              <Logo size={30} />
              <span className="font-serif text-xl font-bold text-primary-700">
                CodexAtlas
              </span>
              <span className="hidden sm:inline rounded-full bg-secondary-100 px-2 py-0.5 text-xs font-medium text-secondary-700">
                Alpha
              </span>
            </Link>
          </div>

          {/* Center: desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => {
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary-50 text-primary-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-primary-700"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right: auth */}
          <div className="hidden justify-end md:flex">
            {user ? (
              <div ref={dropdownRef} className="relative">
                <button
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700 hover:bg-primary-200 transition-colors"
                  aria-label="User menu"
                  aria-expanded={dropdownOpen}
                >
                  {(user.email?.[0] ?? "U").toUpperCase()}
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                    <div className="border-b border-gray-100 px-4 py-2">
                      <p className="truncate text-sm text-gray-700">
                        {user.email}
                      </p>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/auth/login"
                className="rounded-lg bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      <MobileNav
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        user={user}
        onSignOut={handleSignOut}
        pathname={pathname}
      />
    </>
  );
}
