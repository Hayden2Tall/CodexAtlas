"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { StarRating } from "@/components/ui/star-rating";
import { ReviewCard } from "@/components/ui/review-card";
import type { Review, Json } from "@/lib/types";

interface ReviewWithReviewer extends Review {
  users?: { display_name: string | null } | null;
}

interface ReviewSectionProps {
  translationVersionId: string;
  existingReviews: ReviewWithReviewer[];
  isAuthenticated: boolean;
}

export function ReviewSection({
  translationVersionId,
  existingReviews,
  isAuthenticated,
}: ReviewSectionProps) {
  const router = useRouter();
  const [reviews, setReviews] = useState(existingReviews);
  const [rating, setRating] = useState(0);
  const [critique, setCritique] = useState("");
  const [showStructured, setShowStructured] = useState(false);
  const [accuracy, setAccuracy] = useState(0);
  const [fluency, setFluency] = useState(0);
  const [terminology, setTerminology] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (rating === 0) {
        setError("Please select a rating.");
        return;
      }
      setSubmitting(true);
      setError(null);

      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be signed in to submit a review.");
        setSubmitting(false);
        return;
      }

      const structuredFeedback: Json =
        showStructured && (accuracy || fluency || terminology)
          ? {
              ...(accuracy && { accuracy }),
              ...(fluency && { fluency }),
              ...(terminology && { terminology }),
            }
          : {};

      const { data, error: insertError } = await supabase
        .from("reviews")
        .insert({
          translation_version_id: translationVersionId,
          reviewer_id: user.id,
          rating,
          critique: critique.trim(),
          structured_feedback: structuredFeedback,
        } as Record<string, unknown>)
        .select("*, users(display_name)")
        .single<ReviewWithReviewer>();

      if (insertError || !data) {
        setError(insertError?.message ?? "Failed to submit review.");
        setSubmitting(false);
        return;
      }

      setReviews((prev) => [data as ReviewWithReviewer, ...prev]);
      setRating(0);
      setCritique("");
      setAccuracy(0);
      setFluency(0);
      setTerminology(0);
      setShowStructured(false);
      setSubmitting(false);
      router.refresh();
    },
    [
      rating,
      critique,
      showStructured,
      accuracy,
      fluency,
      terminology,
      translationVersionId,
      router,
    ]
  );

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-xl font-bold text-gray-900">
          Reviews
        </h2>
        {reviews.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <StarRating value={Math.round(averageRating)} readonly size="sm" />
            <span>
              {averageRating.toFixed(1)} ({reviews.length}{" "}
              {reviews.length === 1 ? "review" : "reviews"})
            </span>
          </div>
        )}
      </div>

      {/* Submit Review Form */}
      {isAuthenticated ? (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4"
        >
          <h3 className="mb-3 text-sm font-semibold text-gray-800">
            Submit Review
          </h3>

          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Rating <span className="text-red-500">*</span>
            </label>
            <StarRating value={rating} onChange={setRating} size="md" />
          </div>

          <div className="mb-3">
            <button
              type="button"
              onClick={() => setShowStructured(!showStructured)}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:text-primary-800"
            >
              <svg
                className={`h-3 w-3 transition-transform ${showStructured ? "rotate-90" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m8.25 4.5 7.5 7.5-7.5 7.5"
                />
              </svg>
              Structured Feedback
            </button>

            {showStructured && (
              <div className="mt-2 space-y-2 rounded-lg border border-gray-200 bg-white p-3">
                <FeedbackRow
                  label="Accuracy"
                  value={accuracy}
                  onChange={setAccuracy}
                />
                <FeedbackRow
                  label="Fluency"
                  value={fluency}
                  onChange={setFluency}
                />
                <FeedbackRow
                  label="Terminology"
                  value={terminology}
                  onChange={setTerminology}
                />
              </div>
            )}
          </div>

          <div className="mb-3">
            <label
              htmlFor="critique"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Critique <span className="text-red-500">*</span>
            </label>
            <textarea
              id="critique"
              required
              rows={3}
              value={critique}
              onChange={(e) => setCritique(e.target.value)}
              placeholder="Provide your review of this translation…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          {error && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-primary-700 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-800 disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit Review"}
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          <a href="/auth/login" className="font-medium text-primary-700 hover:text-primary-800">Sign in</a> to submit a review of this translation.
        </div>
      )}

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          No reviews yet. Be the first to review this translation.
        </p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </section>
  );
}

function FeedbackRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">{label}</span>
      <StarRating value={value} onChange={onChange} size="sm" />
    </div>
  );
}
