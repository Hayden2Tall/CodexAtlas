"use client";

import { useState, useRef, useCallback } from "react";

const INSTITUTIONS = [
  {
    id: "e-codices",
    name: "e-codices (Virtual Manuscript Library of Switzerland)",
    approximateCount: 1700,
  },
  {
    id: "vatican",
    name: "Vatican DigiVatLib",
    approximateCount: 80000,
  },
  {
    id: "british-library",
    name: "British Library Digitised Manuscripts",
    approximateCount: 3000,
  },
] as const;

const BATCH_SIZE = 50; // Safe for Vercel 60s timeout

interface HarvestStats {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

export function IiifHarvestPanel() {
  const [institutionId, setInstitutionId] = useState<string>(
    INSTITUTIONS[0].id
  );
  const [dryRun, setDryRun] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<HarvestStats | null>(null);
  const [statusLine, setStatusLine] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const selectedInstitution =
    INSTITUTIONS.find((i) => i.id === institutionId) ?? INSTITUTIONS[0];

  const startHarvest = useCallback(async () => {
    cancelRef.current = false;
    setIsRunning(true);
    setError(null);
    setStats({ created: 0, updated: 0, skipped: 0, errors: 0 });
    setStatusLine("Starting harvest…");

    const accumulated: HarvestStats = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    let offset = 0;
    let hasMore = true;

    while (hasMore && !cancelRef.current) {
      setStatusLine(
        `Batch offset=${offset} — Created: ${accumulated.created} | Updated: ${accumulated.updated} | Skipped: ${accumulated.skipped} | Errors: ${accumulated.errors}`
      );

      try {
        const res = await fetch("/api/iiif/harvest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            institution_id: institutionId,
            limit: BATCH_SIZE,
            offset,
            dry_run: dryRun,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error ?? `HTTP ${res.status}`
          );
        }

        const data = await res.json();
        accumulated.created += data.created ?? 0;
        accumulated.updated += data.updated ?? 0;
        accumulated.skipped += data.skipped ?? 0;
        accumulated.errors += data.errors ?? 0;
        setStats({ ...accumulated });

        hasMore = !!data.has_more;
        offset += BATCH_SIZE;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Request failed"
        );
        hasMore = false;
      }
    }

    if (cancelRef.current) {
      setStatusLine("Cancelled.");
    } else {
      setStatusLine(
        `Complete. Created: ${accumulated.created} | Updated: ${accumulated.updated} | Skipped: ${accumulated.skipped} | Errors: ${accumulated.errors}`
      );
    }

    setIsRunning(false);
  }, [institutionId, dryRun]);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="border-b border-gray-100 dark:border-gray-800 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">IIIF Harvest</h2>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          Import manuscript metadata records from IIIF institutions.
        </p>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Institution
            </label>
            <select
              value={institutionId}
              onChange={(e) => setInstitutionId(e.target.value)}
              disabled={isRunning}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-gray-100 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
            >
              {INSTITUTIONS.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              disabled={isRunning}
              className="rounded border-gray-300"
            />
            Dry run (no DB writes)
          </label>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Estimated ~{selectedInstitution.approximateCount.toLocaleString()} manifests.
          Batch size: {BATCH_SIZE}. Processed in batches to avoid Vercel timeout.
        </p>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
            {error}
          </div>
        )}

        {statusLine && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{statusLine}</p>
        )}

        {stats && (
          <div className="grid grid-cols-4 gap-3">
            {(
              [
                { label: "Created", value: stats.created, color: "text-green-700 dark:text-green-400" },
                { label: "Updated", value: stats.updated, color: "text-blue-700 dark:text-blue-400" },
                { label: "Skipped", value: stats.skipped, color: "text-gray-600 dark:text-gray-400" },
                { label: "Errors", value: stats.errors, color: "text-red-600 dark:text-red-400" },
              ] as const
            ).map(({ label, value, color }) => (
              <div key={label} className="rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2">
                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">{label}</p>
                <p className={`text-lg font-semibold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          {!isRunning ? (
            <button
              type="button"
              onClick={startHarvest}
              className="rounded-lg bg-primary-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-800"
            >
              {dryRun ? "Run Dry Harvest" : "Start Harvest"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                cancelRef.current = true;
              }}
              className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
