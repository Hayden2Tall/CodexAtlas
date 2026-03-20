"use client";

import { useState, useEffect } from "react";

interface UsageEntry {
  id: string;
  route: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: string;
  created_at: string;
}

interface Totals {
  cost_usd: number;
  tokens_in: number;
  tokens_out: number;
}

const ROUTE_LABELS: Record<string, string> = {
  "/api/translate": "Translate",
  "/api/summaries/passage": "Passage Summary",
  "/api/summaries/chapter": "Chapter Summary",
  "/api/summaries/manuscript": "Manuscript Summary",
  "/api/summaries/cross-manuscript": "Cross-Manuscript",
  "/api/summaries/book": "Book Summary",
  "/api/summaries/grand": "Grand Assessment",
};

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function UsageSection() {
  const [entries, setEntries] = useState<UsageEntry[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/usage")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setEntries(d.entries ?? []);
        setTotals(d.totals ?? null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="mb-1 text-base font-semibold text-gray-900">AI Usage</h2>
      <p className="mb-4 text-xs text-gray-500">Your recent AI task activity (last 100 calls).</p>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && totals && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Total Cost</p>
            <p className="mt-0.5 text-lg font-bold text-gray-900">${totals.cost_usd.toFixed(4)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Tokens In</p>
            <p className="mt-0.5 text-lg font-bold text-gray-900">{formatTokens(totals.tokens_in)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Tokens Out</p>
            <p className="mt-0.5 text-lg font-bold text-gray-900">{formatTokens(totals.tokens_out)}</p>
          </div>
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <p className="text-sm text-gray-400">No activity yet — run some AI tasks to see them here.</p>
      )}

      {!loading && !error && entries.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="min-w-full divide-y divide-gray-100 text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">Time</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500">Task</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-500">Tokens</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-500">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-400">{formatTime(e.created_at)}</td>
                  <td className="px-3 py-2 text-gray-700">{ROUTE_LABELS[e.route] ?? e.route}</td>
                  <td className="px-3 py-2 text-right text-gray-500">
                    {formatTokens(e.tokens_in + e.tokens_out)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-gray-700">
                    ${Number(e.cost_usd).toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
