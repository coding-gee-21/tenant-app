import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Camera,
  ChevronDown,
  MessageSquarePlus,
  Star,
  Users
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import ReviewCard from './ReviewCard';

const categories = [
  ['water_rating', 'Water reliability'],
  ['security_rating', 'Security'],
  ['management_rating', 'Management'],
  ['value_rating', 'Value for money'],
  ['electricity_rating', 'Electricity'],
  ['cleanliness_rating', 'Cleanliness']
];

function StarInput({ value, onChange, size = 24 }) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          type="button"
          key={star}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
          aria-label={`Rate ${star} out of 5`}
          className="transition hover:scale-110"
        >
          <Star
            size={size}
            className={
              star <= (hovered || value)
                ? 'text-amber-400'
                : 'text-gray-600'
            }
            fill={
              star <= (hovered || value)
                ? 'currentColor'
                : 'none'
            }
          />
        </button>
      ))}
    </div>
  );
}

function RatingDistribution({ reviews }) {
  return (
    <div className="space-y-2">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = reviews.filter(
          (review) => Number(review.rating) === star
        ).length;

        const percentage = reviews.length
          ? Math.round((count / reviews.length) * 100)
          : 0;

        return (
          <div key={star} className="flex items-center gap-3 text-xs">
            <span className="w-7 text-gray-400">{star} ★</span>

            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-amber-400"
                style={{ width: `${percentage}%` }}
              />
            </div>

            <span className="w-6 text-right text-gray-500">
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const initialForm = {
  rating: 0,
  title: '',
  comment: '',
  water_rating: 0,
  security_rating: 0,
  management_rating: 0,
  value_rating: 0,
  electricity_rating: 0,
  cleanliness_rating: 0,
  would_recommend: true,
  is_anonymous: false
};

export default function ReviewSection({
  propertyId,
  propertyOwnerId
}) {
  const [reviews, setReviews] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [sortBy, setSortBy] = useState('helpful');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [photosOnly, setPhotosOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const loadReviews = async () => {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    setCurrentUser(user || null);

    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        profiles(full_name, student_verified),
        review_responses(id, landlord_id, response, created_at, updated_at)
      `)
      .eq('property_id', propertyId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Could not load reviews:', error.message);
      return;
    }

    let helpfulReviewIds = [];

    if (user && data?.length) {
      const { data: helpfulVotes } = await supabase
        .from('review_helpful_votes')
        .select('review_id')
        .eq('user_id', user.id)
        .in(
          'review_id',
          data.map((review) => review.id)
        );

      helpfulReviewIds =
        helpfulVotes?.map((vote) => vote.review_id) || [];
    }

    setReviews(
      (data || []).map((review) => ({
        ...review,
        viewer_found_helpful: helpfulReviewIds.includes(review.id)
      }))
    );
  };

  useEffect(() => {
    if (propertyId) loadReviews();
  }, [propertyId]);

  const visibleReviews = useMemo(() => {
    let result = reviews.filter((review) => {
      // Every published review is protected by the email-confirmation RLS
      // policy. This filter remains useful for the stronger student badge.
      if (verifiedOnly && !review.profiles?.student_verified) return false;

      if (photosOnly && !review.image_url) return false;

      return true;
    });

    result = [...result];

    if (sortBy === 'helpful') {
      result.sort(
        (a, b) => (b.helpful_count || 0) - (a.helpful_count || 0)
      );
    } else if (sortBy === 'highest') {
      result.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'lowest') {
      result.sort((a, b) => a.rating - b.rating);
    } else {
      result.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
    }

    return result;
  }, [reviews, sortBy, verifiedOnly, photosOnly]);

  const averageRating = reviews.length
    ? reviews.reduce(
        (total, review) => total + Number(review.rating),
        0
      ) / reviews.length
    : 0;

  const recommendationPercentage = reviews.length
    ? Math.round(
        (reviews.filter((review) => review.would_recommend).length /
          reviews.length) *
          100
      )
    : 0;

  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  const handleImage = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setMessage('The review photo must be smaller than 5 MB.');
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const submitReview = async (event) => {
    event.preventDefault();
    setMessage('');

    if (!currentUser) {
      window.location.href = `/auth?returnTo=${encodeURIComponent(
        `/properties/${propertyId}`
      )}`;
      return;
    }

    if (!form.rating) {
      setMessage('Choose an overall star rating.');
      return;
    }

    const categoriesCompleted = categories.every(
      ([field]) => form[field] >= 1
    );

    if (!categoriesCompleted) {
      setMessage('Please rate every property category.');
      return;
    }

    setSubmitting(true);

    try {
      const emailVerified = Boolean(
        currentUser.email_confirmed_at || currentUser.confirmed_at
      );

      if (!emailVerified) {
        setMessage('Verify your email before publishing a review.');
        return;
      }

      let imageUrl = null;

      if (imageFile) {
        const extension =
          imageFile.name.split('.').pop()?.toLowerCase() || 'jpg';

        const path =
          `${currentUser.id}/${propertyId}-${Date.now()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from('review-images')
          .upload(path, imageFile);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('review-images')
          .getPublicUrl(path);

        imageUrl = data.publicUrl;
      }

      const { error } = await supabase
        .from('reviews')
        .upsert(
          {
            property_id: propertyId,
            user_id: currentUser.id,
            ...form,
            image_url: imageUrl,
            status: 'approved',
            updated_at: new Date().toISOString()
          },
          {
            onConflict: 'user_id,property_id'
          }
        );

      if (error) throw error;

      setForm(initialForm);
      setImageFile(null);
      setImagePreview('');
      setShowForm(false);
      setMessage('Your review has been published.');
      await loadReviews();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleHelpful = async (review) => {
    if (!currentUser) {
      window.location.href = `/auth?returnTo=${encodeURIComponent(
        `/properties/${propertyId}`
      )}`;
      return;
    }

    if (review.viewer_found_helpful) {
      await supabase
        .from('review_helpful_votes')
        .delete()
        .eq('review_id', review.id)
        .eq('user_id', currentUser.id);
    } else {
      await supabase
        .from('review_helpful_votes')
        .insert({
          review_id: review.id,
          user_id: currentUser.id
        });
    }

    await loadReviews();
  };

  const reportReview = async (reviewId) => {
    if (!currentUser) {
      window.location.href = `/auth?returnTo=${encodeURIComponent(
        `/properties/${propertyId}`
      )}`;
      return;
    }

    const reason = window.prompt(
      'Briefly explain why this review should be checked:'
    );

    if (!reason?.trim()) return;

    const { error } = await supabase
      .from('review_reports')
      .insert({
        review_id: reviewId,
        reporter_id: currentUser.id,
        reason: reason.trim()
      });

    if (error) {
      setMessage(
        error.code === '23505'
          ? 'You have already reported this review.'
          : error.message
      );
      return;
    }

    setMessage('The review has been reported for administrator review.');
  };

  const respondToReview = async (reviewId, response) => {
    if (!currentUser || currentUser.id !== propertyOwnerId) return;

    const { error } = await supabase
      .from('review_responses')
      .upsert(
        {
          review_id: reviewId,
          landlord_id: currentUser.id,
          response,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'review_id'
        }
      );

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadReviews();
  };

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-[#18181B] p-6 md:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row">
          <div>
            <p className="text-sm font-medium text-blue-400">
              Student experience
            </p>

            <h2 className="mt-1 text-2xl font-bold text-white">
              What students are saying
            </h2>

            <div className="mt-5 flex items-end gap-3">
              <span className="text-5xl font-bold text-white">
                {averageRating.toFixed(1)}
              </span>

              <div className="pb-1">
                <div className="flex text-amber-400">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={18}
                      fill={
                        star <= Math.round(averageRating)
                          ? 'currentColor'
                          : 'none'
                      }
                      className={
                        star <= Math.round(averageRating)
                          ? ''
                          : 'text-gray-600'
                      }
                    />
                  ))}
                </div>

                <p className="mt-1 text-xs text-gray-500">
                  Based on {reviews.length}{' '}
                  {reviews.length === 1 ? 'review' : 'reviews'}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <span className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
                <Users size={14} />
                {recommendationPercentage}% recommend
              </span>

              <span className="flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1.5 text-xs text-blue-300">
                <BarChart3 size={14} />
                Real student experiences
              </span>
            </div>
          </div>

          <div className="w-full max-w-sm">
            <RatingDistribution reviews={reviews} />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((current) => !current)}
          className="mt-7 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500"
        >
          <MessageSquarePlus size={18} />
          {showForm ? 'Close review form' : 'Write a review'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={submitReview}
          className="rounded-3xl border border-blue-500/20 bg-[#18181B] p-6 md:p-8"
        >
          <h3 className="text-xl font-bold text-white">
            Share your experience
          </h3>

          <p className="mt-1 text-sm text-gray-400">
            Give an honest and respectful assessment of this property.
          </p>

          <div className="mt-7">
            <label className="text-sm font-medium text-gray-200">
              Overall rating
            </label>

            <div className="mt-2">
              <StarInput
                value={form.rating}
                onChange={(value) => updateForm('rating', value)}
                size={30}
              />
            </div>
          </div>

          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            {categories.map(([field, label]) => (
              <div
                key={field}
                className="rounded-xl border border-white/5 bg-[#111114] p-4"
              >
                <label className="text-xs font-medium text-gray-300">
                  {label}
                </label>

                <div className="mt-2">
                  <StarInput
                    value={form[field]}
                    onChange={(value) => updateForm(field, value)}
                    size={20}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-2">
            <label className="text-sm font-medium text-gray-200">
              Review title
            </label>

            <input
              required
              maxLength="100"
              value={form.title}
              onChange={(event) =>
                updateForm('title', event.target.value)
              }
              placeholder="Example: Comfortable rooms, but unreliable water"
              className="w-full rounded-xl border border-white/10 bg-[#101013] p-3 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>

          <div className="mt-5 space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium text-gray-200">
                Your experience
              </label>

              <span className="text-xs text-gray-500">
                {form.comment.length}/1200
              </span>
            </div>

            <textarea
              required
              minLength="30"
              maxLength="1200"
              rows="5"
              value={form.comment}
              onChange={(event) =>
                updateForm('comment', event.target.value)
              }
              placeholder="Describe water, security, management, cleanliness and anything future tenants should know..."
              className="w-full rounded-xl border border-white/10 bg-[#101013] p-3 text-sm leading-6 text-white outline-none focus:border-blue-500"
            />
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/15 bg-[#101013] p-4 hover:border-blue-500/50">
              <Camera className="text-blue-400" />

              <span>
                <strong className="block text-sm text-white">
                  Add a photo
                </strong>

                <span className="text-xs text-gray-500">
                  JPG, PNG or WebP · Maximum 5 MB
                </span>
              </span>

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImage}
                className="hidden"
              />
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#101013] p-4 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={form.would_recommend}
                onChange={(event) =>
                  updateForm(
                    'would_recommend',
                    event.target.checked
                  )
                }
              />

              I would recommend this property
            </label>
          </div>

          {imagePreview && (
            <img
              src={imagePreview}
              alt="Review upload preview"
              className="mt-4 h-40 w-56 rounded-xl object-cover"
            />
          )}

          <label className="mt-5 flex items-center gap-3 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={form.is_anonymous}
              onChange={(event) =>
                updateForm('is_anonymous', event.target.checked)
              }
            />

            Display this review anonymously
          </label>

          {message && (
            <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-gray-300">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? 'Publishing review…' : 'Publish review'}
          </button>
        </form>
      )}

      {message && !showForm && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-gray-300">
          {message}
        </div>
      )}

      <div className="flex flex-col justify-between gap-3 sm:flex-row">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setVerifiedOnly((current) => !current)}
            className={`rounded-full border px-3 py-2 text-xs ${
              verifiedOnly
                ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                : 'border-white/10 text-gray-400'
            }`}
          >
            Verified students
          </button>

          <button
            type="button"
            onClick={() => setPhotosOnly((current) => !current)}
            className={`rounded-full border px-3 py-2 text-xs ${
              photosOnly
                ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                : 'border-white/10 text-gray-400'
            }`}
          >
            Reviews with photos
          </button>
        </div>

        <div className="relative">
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="appearance-none rounded-xl border border-white/10 bg-[#18181B] py-2 pl-3 pr-9 text-sm text-gray-300 outline-none"
          >
            <option value="helpful">Most helpful</option>
            <option value="newest">Newest</option>
            <option value="highest">Highest rated</option>
            <option value="lowest">Lowest rated</option>
          </select>

          <ChevronDown
            size={15}
            className="pointer-events-none absolute right-3 top-3 text-gray-500"
          />
        </div>
      </div>

      <div className="space-y-4">
        {visibleReviews.length ? (
          visibleReviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              currentUserId={currentUser?.id}
              isPropertyOwner={
                currentUser?.id === propertyOwnerId
              }
              onHelpful={toggleHelpful}
              onReport={reportReview}
              onRespond={respondToReview}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-white/10 bg-[#18181B] p-10 text-center">
            <p className="font-medium text-white">
              No matching reviews
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Be the first student to share a helpful experience.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
