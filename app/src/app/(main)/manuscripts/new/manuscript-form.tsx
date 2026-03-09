"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ANCIENT_LANGUAGES } from "@/lib/utils/languages";
import type { Manuscript } from "@/lib/types";

interface FormErrors {
  title?: string;
  original_language?: string;
  general?: string;
}

export function ManuscriptForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const [title, setTitle] = useState("");
  const [originalLanguage, setOriginalLanguage] = useState("");
  const [customLanguage, setCustomLanguage] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateStartBce, setDateStartBce] = useState(false);
  const [dateEnd, setDateEnd] = useState("");
  const [dateEndBce, setDateEndBce] = useState(false);
  const [originLocation, setOriginLocation] = useState("");
  const [archiveLocation, setArchiveLocation] = useState("");
  const [archiveIdentifier, setArchiveIdentifier] = useState("");
  const [description, setDescription] = useState("");
  const [historicalContext, setHistoricalContext] = useState("");

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!title.trim()) errs.title = "Title is required.";
    if (!originalLanguage) errs.original_language = "Language is required.";
    if (originalLanguage === "other" && !customLanguage.trim()) {
      errs.original_language = "Please specify the language code.";
    }
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);

    const language =
      originalLanguage === "other" ? customLanguage.trim() : originalLanguage;

    const parsedStart = dateStart
      ? (dateStartBce ? -1 : 1) * Math.abs(parseInt(dateStart, 10))
      : null;
    const parsedEnd = dateEnd
      ? (dateEndBce ? -1 : 1) * Math.abs(parseInt(dateEnd, 10))
      : null;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("manuscripts")
      .insert({
        title: title.trim(),
        original_language: language,
        estimated_date_start: parsedStart,
        estimated_date_end: parsedEnd,
        origin_location: originLocation.trim() || null,
        archive_location: archiveLocation.trim() || null,
        archive_identifier: archiveIdentifier.trim() || null,
        description: description.trim() || null,
        historical_context: historicalContext.trim() || null,
      } as Record<string, unknown>)
      .select("id")
      .single<Pick<Manuscript, "id">>();

    if (error) {
      setErrors({ general: error.message });
      setSubmitting(false);
      return;
    }

    router.push(`/manuscripts/${data.id}`);
  }

  const languageOptions = Object.entries(ANCIENT_LANGUAGES);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errors.general && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.general}
        </div>
      )}

      {/* Title */}
      <Field label="Title" required error={errors.title}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Codex Sinaiticus"
          className={inputClass(errors.title)}
        />
      </Field>

      {/* Language */}
      <Field label="Original Language" required error={errors.original_language}>
        <select
          value={originalLanguage}
          onChange={(e) => setOriginalLanguage(e.target.value)}
          className={inputClass(errors.original_language)}
        >
          <option value="">Select a language…</option>
          {languageOptions.map(([code, name]) => (
            <option key={code} value={code}>
              {name} ({code})
            </option>
          ))}
          <option value="other">Other…</option>
        </select>
        {originalLanguage === "other" && (
          <input
            type="text"
            value={customLanguage}
            onChange={(e) => setCustomLanguage(e.target.value)}
            placeholder="ISO 639-3 code (e.g., phn)"
            className={`mt-2 ${inputClass(errors.original_language)}`}
          />
        )}
      </Field>

      {/* Date Range */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Estimated Date (Start)">
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              placeholder="e.g., 150"
              min="0"
              className={`flex-1 ${inputClass()}`}
            />
            <label className="flex items-center gap-1.5 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={dateStartBce}
                onChange={(e) => setDateStartBce(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-700 focus:ring-primary-500"
              />
              BCE
            </label>
          </div>
        </Field>
        <Field label="Estimated Date (End)">
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              placeholder="e.g., 250"
              min="0"
              className={`flex-1 ${inputClass()}`}
            />
            <label className="flex items-center gap-1.5 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={dateEndBce}
                onChange={(e) => setDateEndBce(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-700 focus:ring-primary-500"
              />
              BCE
            </label>
          </div>
        </Field>
      </div>

      {/* Location */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Origin Location">
          <input
            type="text"
            value={originLocation}
            onChange={(e) => setOriginLocation(e.target.value)}
            placeholder="e.g., Alexandria, Egypt"
            className={inputClass()}
          />
        </Field>
        <Field label="Archive Location">
          <input
            type="text"
            value={archiveLocation}
            onChange={(e) => setArchiveLocation(e.target.value)}
            placeholder="e.g., British Library, London"
            className={inputClass()}
          />
        </Field>
      </div>

      {/* Archive Identifier */}
      <Field label="Archive Identifier">
        <input
          type="text"
          value={archiveIdentifier}
          onChange={(e) => setArchiveIdentifier(e.target.value)}
          placeholder="e.g., Add. MS 43725"
          className={inputClass()}
        />
      </Field>

      {/* Description */}
      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Brief description of the manuscript…"
          className={inputClass()}
        />
      </Field>

      {/* Historical Context */}
      <Field label="Historical Context">
        <textarea
          value={historicalContext}
          onChange={(e) => setHistoricalContext(e.target.value)}
          rows={4}
          placeholder="Historical background, provenance notes…"
          className={inputClass()}
        />
      </Field>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-6">
        <Link
          href="/manuscripts"
          className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-700 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-800 disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create Manuscript"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function inputClass(error?: string): string {
  const base =
    "w-full rounded-lg border bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:outline-none focus:ring-2";
  if (error) {
    return `${base} border-red-300 focus:border-red-500 focus:ring-red-500/20`;
  }
  return `${base} border-gray-300 focus:border-primary-500 focus:ring-primary-500/20`;
}
