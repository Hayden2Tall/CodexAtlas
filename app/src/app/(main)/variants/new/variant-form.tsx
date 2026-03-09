"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Variant } from "@/lib/types";

export function VariantForm() {
  const router = useRouter();
  const [passageReference, setPassageReference] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();

    const { data, error: insertError } = await supabase
      .from("variants")
      .insert({
        passage_reference: passageReference.trim(),
        description: description.trim() || null,
      } as Record<string, unknown>)
      .select("id")
      .single<Pick<Variant, "id">>();

    if (insertError || !data) {
      setError(insertError?.message ?? "Failed to create variant.");
      setSubmitting(false);
      return;
    }

    router.push(`/variants/${data.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="passage_reference"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Passage Reference <span className="text-red-500">*</span>
        </label>
        <input
          id="passage_reference"
          type="text"
          required
          value={passageReference}
          onChange={(e) => setPassageReference(e.target.value)}
          placeholder="e.g. Mark 1:1"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Description
        </label>
        <textarea
          id="description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the textual variant…"
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
          {submitting ? "Creating…" : "Create Variant"}
        </button>
      </div>
    </form>
  );
}
