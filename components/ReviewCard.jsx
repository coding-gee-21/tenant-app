import { useState } from 'react';
import {
  BadgeCheck,
  Building2,
  Flag,
  ImageIcon,
  Star,
  ThumbsUp
} from 'lucide-react';

function CategoryBadge({ label, value }) {
  if (!value) return null;

  const colour =
    value >= 4
      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
      : value >= 3
      ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
      : 'border-red-500/20 bg-red-500/10 text-red-300';

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs ${colour}`}>
      {label} {Number(value).toFixed(1)}
    </span>
  );
}

function reviewerName(review) {
  if (review.is_anonymous) return 'Anonymous Student';

  const fullName = review.profiles?.full_name?.trim();

  if (!fullName) return 'Chuka Rentals Student';

  const names = fullName.split(/\s+/);
  return names.length > 1
    ? `${names[0]} ${names[names.length - 1][0]}.`
    : names[0];
}

export default function ReviewCard({
  review,
  currentUserId,
  isPropertyOwner,
  onHelpful,
  onReport,
  onRespond
}) {
  const [response, setResponse] = useState('');
  const [showResponseForm, setShowResponseForm] = useState(false);

  const landlordResponse = Array.isArray(review.review_responses)
    ? review.review_responses[0]
    : null;

  const handleResponse = async () => {
    if (!response.trim()) return;

    await onRespond(review.id, response.trim());

    setResponse('');
    setShowResponseForm(false);
  };

  return (
    <article className="rounded-2xl border border-white/10 bg-[#18181B] p-5 md:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 font-bold text-white">
          {review.is_anonymous
            ? 'S'
            : reviewerName(review).charAt(0).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col justify-between gap-2 sm:flex-row">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-semibold text-white">
                  {reviewerName(review)}
                </h4>

                {!review.is_anonymous &&
                  review.profiles?.student_verified && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                      <BadgeCheck size={12} />
                      Verified student
                    </span>
                  )}

                {!review.is_anonymous &&
                  !review.profiles?.student_verified && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-300">
                      <BadgeCheck size={12} />
                      Email verified
                    </span>
                  )}
              </div>

              <div className="mt-1 flex items-center gap-2">
                <div
                  className="flex text-amber-400"
                  aria-label={`${review.rating} out of 5 stars`}
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={15}
                      fill={star <= review.rating ? 'currentColor' : 'none'}
                      className={
                        star <= review.rating
                          ? ''
                          : 'text-gray-600'
                      }
                    />
                  ))}
                </div>

                {review.would_recommend && (
                  <span className="text-xs text-emerald-400">
                    Recommends this property
                  </span>
                )}
              </div>
            </div>

            <time className="text-xs text-gray-500">
              {new Date(review.created_at).toLocaleDateString('en-KE', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
              {review.updated_at &&
                review.updated_at !== review.created_at &&
                ' · Edited'}
            </time>
          </div>

          {review.title && (
            <h5 className="mt-4 font-semibold text-gray-100">
              {review.title}
            </h5>
          )}

          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-300">
            {review.comment}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <CategoryBadge label="Water" value={review.water_rating} />
            <CategoryBadge label="Security" value={review.security_rating} />
            <CategoryBadge
              label="Management"
              value={review.management_rating}
            />
            <CategoryBadge label="Value" value={review.value_rating} />
            <CategoryBadge
              label="Electricity"
              value={review.electricity_rating}
            />
            <CategoryBadge
              label="Cleanliness"
              value={review.cleanliness_rating}
            />
          </div>

          {review.image_url && (
            <a
              href={review.image_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 block w-fit"
            >
              <img
                src={review.image_url}
                alt="Photo attached to review"
                className="h-40 w-56 rounded-xl border border-white/10 object-cover transition hover:opacity-90"
              />
              <span className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                <ImageIcon size={12} />
                Review photo
              </span>
            </a>
          )}

          {landlordResponse && (
            <div className="mt-5 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-300">
                <Building2 size={16} />
                Response from property management
              </div>

              <p className="mt-2 text-sm leading-6 text-gray-300">
                {landlordResponse.response}
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-white/5 pt-4">
            <button
              type="button"
              onClick={() => onHelpful(review)}
              className={`flex items-center gap-1.5 text-xs transition ${
                review.viewer_found_helpful
                  ? 'text-blue-300'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <ThumbsUp
                size={14}
                fill={
                  review.viewer_found_helpful
                    ? 'currentColor'
                    : 'none'
                }
              />
              Helpful ({review.helpful_count || 0})
            </button>

            {currentUserId && currentUserId !== review.user_id && (
              <button
                type="button"
                onClick={() => onReport(review.id)}
                className="flex items-center gap-1.5 text-xs text-gray-500 transition hover:text-red-400"
              >
                <Flag size={14} />
                Report
              </button>
            )}

            {isPropertyOwner && !landlordResponse && (
              <button
                type="button"
                onClick={() => setShowResponseForm((current) => !current)}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Respond as property manager
              </button>
            )}
          </div>

          {showResponseForm && (
            <div className="mt-4 space-y-3">
              <textarea
                rows="3"
                maxLength="1000"
                value={response}
                onChange={(event) => setResponse(event.target.value)}
                placeholder="Write a professional response to this review..."
                className="w-full rounded-xl border border-white/10 bg-[#101013] p-3 text-sm text-white outline-none focus:border-blue-500"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleResponse}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
                >
                  Publish response
                </button>

                <button
                  type="button"
                  onClick={() => setShowResponseForm(false)}
                  className="rounded-lg bg-white/5 px-4 py-2 text-xs text-gray-300 hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
