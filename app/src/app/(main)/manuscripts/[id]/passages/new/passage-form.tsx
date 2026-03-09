"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { TranscriptionMethod } from "@/lib/types";

interface PassageFormProps {
  manuscriptId: string;
}

interface FormErrors {
  reference?: string;
  original_text?: string;
  general?: string;
}

const TRANSCRIPTION_METHODS: { value: TranscriptionMethod; label: string }[] = [
  { value: "manual", label: "Manual Transcription" },
  { value: "ocr_auto", label: "OCR (Automatic)" },
  { value: "ocr_reviewed", label: "OCR (Reviewed)" },
];

export function PassageForm({ manuscriptId }: PassageFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const [reference, setReference] = useState("");
  const [sequenceOrder, setSequenceOrder] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [transcriptionMethod, setTranscriptionMethod] =
    useState<TranscriptionMethod>("manual");

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!reference.trim()) errs.reference = "Reference is required.";
    if (!originalText.trim())
      errs.original_text = "Original text is required.";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);

    const supabase = createClient();
    const { error } = await supabase.from("passages").insert({
      manuscript_id: manuscriptId,
      reference: reference.trim(),
      sequence_order: sequenceOrder ? parseInt(sequenceOrder, 10) : null,
      original_text: originalText.trim(),
      transcription_method: transcriptionMethod,
    } as Record<string, unknown>);

    if (error) {
      setErrors({ general: error.message });
      setSubmitting(false);
      return;
    }

    router.push(`/manuscripts/${manuscriptId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errors.general && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.general}
        </div>
      )}

      {/* Reference */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Reference<span className="ml-0.5 text-red-500">*</span>
        </label>
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder='e.g., "Genesis 1:1" or "Folio 12r"'
          className={`w-full rounded-lg border bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:outline-none focus:ring-2 ${
            errors.reference
              ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
              : "border-gray-300 focus:border-primary-500 focus:ring-primary-500/20"
          }`}
        />
        {errors.reference && (
          <p className="mt-1.5 text-sm text-red-600">{errors.reference}</p>
        )}
      </div>

      {/* Sequence Order */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Sequence Order
        </label>
        <input
          type="number"
          value={sequenceOrder}
          onChange={(e) => setSequenceOrder(e.target.value)}
          placeholder="e.g., 1"
          min="0"
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        />
        <p className="mt-1 text-xs text-gray-500">
          Determines display order within this manuscript.
        </p>
      </div>

      {/* Transcription Method */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Transcription Method
        </label>
        <select
          value={transcriptionMethod}
          onChange={(e) =>
            setTranscriptionMethod(e.target.value as TranscriptionMethod)
          }
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          {TRANSCRIPTION_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Original Text */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Original Text<span className="ml-0.5 text-red-500">*</span>
        </label>
        <textarea
          value={originalText}
          onChange={(e) => setOriginalText(e.target.value)}
          rows={8}
          placeholder="Paste or type the original language text…"
          className={`w-full rounded-lg border bg-white px-4 py-2.5 font-mono text-sm text-gray-900 placeholder-gray-400 transition-colors focus:outline-none focus:ring-2 ${
            errors.original_text
              ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
              : "border-gray-300 focus:border-primary-500 focus:ring-primary-500/20"
          }`}
        />
        {errors.original_text && (
          <p className="mt-1.5 text-sm text-red-600">{errors.original_text}</p>
        )}
      </div>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-6">
        <a
          href={`/manuscripts/${manuscriptId}`}
          className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-700 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-800 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Add Passage"}
        </button>
      </div>
    </form>
  );
}
