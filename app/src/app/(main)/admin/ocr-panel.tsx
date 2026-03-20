"use client";

import { useState, useRef } from "react";
import { getLanguageName } from "@/lib/utils/languages";

interface OcrPassage {
  reference: string;
  original_text: string;
  confidence: number;
  notes: string;
}

interface OcrResult {
  full_transcription: string;
  language_detected: string;
  quality_assessment: string;
  passages: OcrPassage[];
}

interface Manuscript {
  id: string;
  title: string;
}

interface Props {
  manuscripts: Manuscript[];
}

export function OcrPanel({ manuscripts }: Props) {
  const [selectedManuscript, setSelectedManuscript] = useState("");
  const [pageReference, setPageReference] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [costInfo, setCostInfo] = useState<{
    tokens_input: number;
    tokens_output: number;
    estimated_cost_usd: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select an image file");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setErrorMessage("Image must be under 20MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl);
      setErrorMessage("");
    };
    reader.readAsDataURL(file);
  }

  async function handleProcess() {
    if (!selectedManuscript || !imageBase64) return;

    setIsProcessing(true);
    setResult(null);
    setCostInfo(null);
    setSavedCount(null);
    setErrorMessage("");

    try {
      const res = await fetch("/api/agent/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manuscript_id: selectedManuscript,
          image_base64: imageBase64,
          page_reference: pageReference || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error ?? "OCR processing failed");
      } else {
        setResult(data.ocr_result);
        setCostInfo(data.usage ?? null);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Network error"
      );
    }

    setIsProcessing(false);
  }

  async function handleSavePassages() {
    if (!result || !selectedManuscript) return;

    setIsSaving(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/agent/ocr", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manuscript_id: selectedManuscript,
          passages: result.passages,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSavedCount(data.passages_created);
      } else {
        setErrorMessage(data.error ?? "Failed to save passages");
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Network error"
      );
    }

    setIsSaving(false);
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        OCR Processing
      </h2>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Upload a manuscript image and extract text using Claude Vision.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
            Manuscript
          </label>
          <select
            value={selectedManuscript}
            onChange={(e) => setSelectedManuscript(e.target.value)}
            disabled={isProcessing}
            className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 px-3 py-1.5 text-sm"
          >
            <option value="">Select a manuscript...</option>
            {manuscripts.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
            Page/Folio Reference
          </label>
          <input
            type="text"
            value={pageReference}
            onChange={(e) => setPageReference(e.target.value)}
            placeholder="e.g., Folio 12r"
            disabled={isProcessing}
            className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500 px-3 py-1.5 text-sm placeholder-gray-400"
          />
        </div>
      </div>

      {/* Image upload */}
      <div className="mt-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="rounded-md border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {imagePreview ? "Change Image" : "Upload Image"}
          </button>
          {imagePreview && !isProcessing && (
            <button
              onClick={handleProcess}
              disabled={!selectedManuscript}
              className="rounded-md bg-primary-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-800 transition-colors disabled:opacity-50"
            >
              Process OCR
            </button>
          )}
          {isProcessing && (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-300 border-t-primary-700" />
              <span className="text-sm text-gray-500">
                Processing image...
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Image preview */}
      {imagePreview && (
        <div className="mt-4 overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagePreview}
            alt="Manuscript page"
            className="max-h-64 w-full object-contain bg-gray-50 dark:bg-gray-800"
          />
        </div>
      )}

      {/* Error */}
      {errorMessage && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Cost info */}
      {costInfo && (
        <div className="mt-4 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span>OCR cost: ${costInfo.estimated_cost_usd.toFixed(4)}</span>
          <span>
            Tokens: {formatTokens(costInfo.tokens_input)} in /{" "}
            {formatTokens(costInfo.tokens_output)} out
          </span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                OCR Results
              </p>
              <div className="mt-0.5 flex gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span>
                  Language: {getLanguageName(result.language_detected)}
                </span>
                <span>{result.passages.length} passages extracted</span>
              </div>
            </div>
            {savedCount != null ? (
              <span className="rounded-md bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                {savedCount} passages saved
              </span>
            ) : (
              <button
                onClick={handleSavePassages}
                disabled={isSaving || result.passages.length === 0}
                className="rounded-md bg-primary-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-800 transition-colors disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save All Passages"}
              </button>
            )}
          </div>

          {result.quality_assessment && (
            <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-2">
              <p className="text-xs text-blue-700 dark:text-blue-400">
                <span className="font-medium">Quality:</span>{" "}
                {result.quality_assessment}
              </p>
            </div>
          )}

          {/* Passages */}
          <div className="space-y-2">
            {result.passages.map((p, i) => (
              <div
                key={`${p.reference}-${i}`}
                className="rounded-md border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {p.reference}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.confidence >= 0.9
                        ? "bg-green-100 text-green-700"
                        : p.confidence >= 0.7
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                    }`}
                  >
                    {Math.round(p.confidence * 100)}%
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap font-mono text-xs text-gray-800 dark:text-gray-200">
                  {p.original_text}
                </p>
                {p.notes && (
                  <p className="mt-1 text-xs italic text-gray-500 dark:text-gray-400">
                    {p.notes}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Full transcription */}
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
              Full Transcription
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-gray-50 dark:bg-gray-800 p-3 font-mono text-xs text-gray-700 dark:text-gray-300">
              {result.full_transcription}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return count.toString();
}
