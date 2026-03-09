"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface ReadingFormProps {
  variantId: string;
  manuscripts: { id: string; title: string }[];
}

export function ReadingForm({ variantId, manuscripts }: ReadingFormProps) {
  const router = useRouter();
  const [manuscriptId, setManuscriptId] = useState("");
  const [readingText, setReadingText] = useState("");
  const [apparatusNotes, setApparatusNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();

    const { error: insertError } = await supabase
      .from("variant_readings")
      .insert({
        variant_id: variantId,
        manuscript_id: manuscriptId,
        reading_text: readingText.trim(),
        apparatus_notes: apparatusNotes.trim() || null,
      } as Record<string, unknown>);

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    router.push(`/variants/${variantId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="manuscript_id"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Manuscript <span className="text-red-500">*</span>
        </label>
        <select
          id="manuscript_id"
          required
          value={manuscriptId}
          onChange={(e) => setManuscriptId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
        >
          <option value="">Select a manuscript…</option>
          {manuscripts.map((ms) => (
            <option key={ms.id} value={ms.id}>
              {ms.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="reading_text"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Reading Text <span className="text-red-500">*</span>
        </label>
        <textarea
          id="reading_text"
          required
          rows={4}
          value={readingText}
          onChange={(e) => setReadingText(e.target.value)}
          placeholder="Enter the manuscript reading…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="apparatus_notes"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Apparatus Notes
        </label>
        <textarea
          id="apparatus_notes"
          rows={2}
          value={apparatusNotes}
          onChange={(e) => setApparatusNotes(e.target.value)}
          placeholder="Optional critical apparatus notes…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-primary-700 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-800 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Add Reading"}
        </button>
      </div>
    </form>
  );
}
