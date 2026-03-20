"use client";

import { useState, useEffect } from "react";

interface ActivityEntry {
  id: string;
  user_id: string;
  route: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: string;
  context: Record<string, unknown> | null;
  created_at: string;
  users: { display_name: string | null } | null;
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

export function ActivityLogPanel() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/activity")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setEntries(d.entries ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Loading activity log…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (entries.length === 0) return <p className="text-sm text-gray-500">No AI activity logged yet.</p>;

  // Aggregate by user
  const byUser = entries.reduce<Record<string, { name: string; cost: number; count: number }>>((acc, e) => {
    const id = e.user_id;
    const name = e.users?.display_name ?? id.slice(0, 8);
    if (!acc[id]) acc[id] = { name, cost: 0, count: 0 };
    acc[id].cost += Number(e.cost_usd);
    acc[id].count += 1;
    return acc;
  }, {});

  const totalCost = entries.reduce((sum, e) => sum + Number(e.cost_usd), 0);

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-medium text-gray-500">Total (last 500)</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">${totalCost.toFixed(4)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-medium text-gray-500">Calls</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{entries.length}</p>
        </div>
      </div>

      {/* Per-user breakdown */}
      {Object.keys(byUser).length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Cost by User</h3>
          <div className="space-y-1.5">
            {Object.values(byUser)
              .sort((a, b) => b.cost - a.cost)
              .map((u) => (
                <div key={u.name} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">{u.name}</span>
                  <span className="text-gray-500">
                    {u.count} calls · ${u.cost.toFixed(4)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Log table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-100 text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Time</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">User</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Route</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Model</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-500">In</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-500">Out</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-500">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-3 py-2 text-gray-500">{formatTime(e.created_at)}</td>
                <td className="px-3 py-2 font-medium text-gray-700">
                  {e.users?.display_name ?? e.user_id.slice(0, 8)}
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {ROUTE_LABELS[e.route] ?? e.route}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                  {e.model.replace("claude-", "").replace("-20251001", "")}
                </td>
                <td className="px-3 py-2 text-right text-gray-500">{formatTokens(e.tokens_in)}</td>
                <td className="px-3 py-2 text-right text-gray-500">{formatTokens(e.tokens_out)}</td>
                <td className="px-3 py-2 text-right font-medium text-gray-700">
                  ${Number(e.cost_usd).toFixed(4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
