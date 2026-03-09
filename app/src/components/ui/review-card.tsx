import { StarRating } from "@/components/ui/star-rating";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Review } from "@/lib/types";

interface ReviewWithReviewer extends Review {
  users?: { display_name: string | null } | null;
}

interface ReviewCardProps {
  review: ReviewWithReviewer;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-24 text-gray-500">{label}</span>
      <div className="h-1.5 flex-1 rounded-full bg-gray-100">
        <div
          className="h-1.5 rounded-full bg-primary-600 transition-all"
          style={{ width: `${(value / 5) * 100}%` }}
        />
      </div>
      <span className="w-5 text-right font-mono text-xs text-gray-600">
        {value}
      </span>
    </div>
  );
}

export function ReviewCard({ review }: ReviewCardProps) {
  const feedback = review.structured_feedback as Record<string, unknown> | null;
  const hasScores =
    feedback != null &&
    (typeof feedback.accuracy === "number" ||
      typeof feedback.fluency === "number" ||
      typeof feedback.terminology === "number");

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-700">
            {(review.users?.display_name ?? "?")[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {review.users?.display_name ?? "Anonymous"}
            </p>
            <p className="text-xs text-gray-500">
              {formatDate(review.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StarRating value={review.rating} readonly size="sm" />
          <StatusBadge status={review.status} />
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-gray-700">
        {review.critique}
      </p>

      {hasScores && feedback && (
        <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
          {typeof feedback.accuracy === "number" && (
            <ScoreBar label="Accuracy" value={feedback.accuracy} />
          )}
          {typeof feedback.fluency === "number" && (
            <ScoreBar label="Fluency" value={feedback.fluency} />
          )}
          {typeof feedback.terminology === "number" && (
            <ScoreBar label="Terminology" value={feedback.terminology} />
          )}
        </div>
      )}
    </div>
  );
}
