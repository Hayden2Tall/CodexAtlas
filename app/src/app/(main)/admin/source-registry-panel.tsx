"use client";

import { useState, useEffect, useCallback } from "react";

interface RegistrySourceStatus {
  id: string;
  sourceId: string;
  displayName: string;
  language: string;
  coverage: string;
  license: string;
  preprocessorScript: string;
  transcriptionMethod: string;
  rowCount: number;
  lastImported: string | null;
  status: "loaded" | "empty";
}

export function SourceRegistryPanel() {
  const [sources, setSources] = useState<RegistrySourceStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/registry/status");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setSources(data.sources ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const totalRows = sources.reduce((sum, s) => sum + s.rowCount, 0);
  const loadedCount = sources.filter((s) => s.status === "loaded").length;

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Source Registry</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Pre-cataloged open-access corpora — {loadedCount}/{sources.length} loaded,{" "}
            {totalRows.toLocaleString()} total rows
          </p>
        </div>
        <button
          type="button"
          onClick={loadStatus}
          disabled={loading}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mx-5 my-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50 text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Source</th>
              <th className="px-4 py-2 font-medium">Lang</th>
              <th className="px-4 py-2 font-medium">Coverage</th>
              <th className="px-4 py-2 font-medium">License</th>
              <th className="px-4 py-2 font-medium">Method</th>
              <th className="px-4 py-2 font-medium">Rows</th>
              <th className="px-4 py-2 font-medium">Last Updated</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sources.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50/30">
                <td className="px-4 py-2.5">
                  <p className="font-medium text-gray-800">{s.displayName}</p>
                  <p className="text-[10px] text-gray-400 font-mono">{s.sourceId}</p>
                </td>
                <td className="px-4 py-2.5 font-mono text-gray-600">{s.language}</td>
                <td className="px-4 py-2.5 capitalize text-gray-600">{s.coverage}</td>
                <td className="px-4 py-2.5 text-gray-500">{s.license}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    s.transcriptionMethod === "scholarly_transcription"
                      ? "bg-green-50 text-green-700"
                      : "bg-blue-50 text-blue-700"
                  }`}>
                    {s.transcriptionMethod === "scholarly_transcription" ? "Scholarly" : "Edition"}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-gray-700">
                  {s.rowCount > 0 ? s.rowCount.toLocaleString() : "—"}
                </td>
                <td className="px-4 py-2.5 text-gray-500">
                  {s.lastImported
                    ? new Date(s.lastImported).toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-4 py-2.5">
                  {s.status === "loaded" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 ring-1 ring-inset ring-green-200">
                      Loaded
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                      Not imported
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {sources.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No data. Click Refresh to load status.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-400">
        Run preprocessor scripts from the project root to import each corpus:
        {sources.filter((s) => s.status === "empty").length > 0 && (
          <code className="ml-1 font-mono text-gray-500">
            node scripts/preprocess-&#123;source&#125;.mjs
          </code>
        )}
      </div>
    </div>
  );
}
