"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSignOut: () => void;
  pathname: string;
}

const navLinks = [
  { href: "/manuscripts", label: "Manuscripts" },
  { href: "/admin", label: "Admin" },
] as const;

export function MobileNav({
  isOpen,
  onClose,
  user,
  onSignOut,
  pathname,
}: MobileNavProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
            <span className="font-serif text-lg font-bold text-primary-700">
              CodexAtlas
            </span>
            <button
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close menu"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Nav Links */}
          <nav className="flex-1 px-4 py-6">
            <ul className="space-y-1">
              {navLinks.map((link) => {
                const isActive = pathname.startsWith(link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={onClose}
                      className={`block rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-primary-50 text-primary-700"
                          : "text-gray-700 hover:bg-gray-50 hover:text-primary-700"
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Auth Footer */}
          <div className="border-t border-gray-200 px-4 py-4">
            {user ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                    {(user.email?.[0] ?? "U").toUpperCase()}
                  </div>
                  <span className="truncate text-sm text-gray-700">
                    {user.email}
                  </span>
                </div>
                <button
                  onClick={() => {
                    onSignOut();
                    onClose();
                  }}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                href="/auth/login"
                onClick={onClose}
                className="block w-full rounded-lg bg-primary-700 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-primary-800 transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
