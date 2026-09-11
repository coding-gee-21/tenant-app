import Head from 'next/head';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  RefreshCw,
  Star,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import PrivateMessageThread from '../../components/PrivateMessageThread';

function reviewerName(review) {
  if (review.is_anonymous) return 'Anonymous student';
  return review.profiles?.full_name?.trim() || 'Student account';
}

function formatDate(value) {
  if (!value) return '';

  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function LandlordReviewMessagesPage() {
  const router = useRouter();
  const [reviews, setReviews] = useState([]);
  const [openReviewId, setOpenReviewId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setPageError('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace(
          '/auth?returnTo=/landlord/review-messages'
        );
        return;
      }

      const landlordId = session.user.id;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', landlordId)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!['landlord', 'admin'].includes(profile?.role)) {
        router.replace('/landlord');
        return;
      }

      const { data: propertyRows, error: propertyError } =
        await supabase
          .from('properties')
          .select('id, title, landmark')
          .or(
            `user_id.eq.${landlordId},landlord_id.eq.${landlordId}`
          );

      if (propertyError) throw propertyError;

      const properties = propertyRows || [];
      const propertyIds = properties.map((property) => property.id);

      if (propertyIds.length === 0) {
        setReviews([]);
        return;
      }

      const { data: reviewRows, error: reviewError } = await supabase
        .from('reviews')
        .select(
          'id, property_id, rating, title, comment, is_anonymous, status, created_at, profiles(full_name)'
        )
        .in('property_id', propertyIds)
        .order('created_at', { ascending: false });

      if (reviewError) throw reviewError;

      const propertyMap = Object.fromEntries(
        properties.map((property) => [property.id, property])
      );

      setReviews(
        (reviewRows || []).map((review) => ({
          ...review,
          property: propertyMap[review.property_id] || null,
        }))
      );
    } catch (error) {
      console.error('Unable to load review discussions:', error);
      setPageError(
        error.message || 'Unable to load review discussions.'
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(loadReviews, 0);
    return () => window.clearTimeout(timer);
  }, [loadReviews]);

  return (
    <>
      <Head>
        <title>Review Discussions | Chuka Rentals</title>
      </Head>

      <main className="min-h-screen bg-[#111214] text-white">
        <section className="mx-auto max-w-5xl px-5 py-10">
          <Link
            href="/landlord/dashboard"
            className="mb-7 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
          >
            <ArrowLeft size={17} />
            Back to landlord dashboard
          </Link>

          <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-emerald-400">
                Private communication
              </p>

              <h1 className="text-3xl font-bold">
                Review Discussions
              </h1>

              <p className="mt-2 max-w-2xl text-slate-400">
                Discuss student reviews privately while keeping the
                original review and any public management response intact.
              </p>
            </div>

            <button
              type="button"
              onClick={loadReviews}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={loading ? 'animate-spin' : ''}
              />
              Refresh
            </button>
          </div>

          <div className="mb-7 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm leading-6 text-blue-100">
            Private discussions are visible only to the review author and
            the property manager. An anonymous reviewer remains anonymous
            to the public.
          </div>

          {pageError && (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
              {pageError}
            </div>
          )}

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-[#17181c] p-12 text-center text-slate-400">
              Loading review discussions...
            </div>
          ) : reviews.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#17181c] p-12 text-center">
              <MessageCircle
                size={40}
                className="mx-auto mb-4 text-slate-600"
              />
              <h2 className="text-xl font-bold">No reviews found</h2>
              <p className="mt-2 text-slate-400">
                Reviews for your properties will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {reviews.map((review) => (
                <article
                  key={review.id}
                  className="rounded-2xl border border-white/10 bg-[#17181c] p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="font-bold">
                        {reviewerName(review)}
                      </h2>

                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-400">
                        <span className="inline-flex items-center gap-2">
                          <Building2 size={15} />
                          {review.property?.title || 'Property'}
                        </span>

                        <span>{formatDate(review.created_at)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-amber-400">
                        <Star size={16} fill="currentColor" />
                        {review.rating}
                      </span>

                      {review.status && (
                        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] capitalize text-slate-400">
                          {review.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {review.title && (
                    <h3 className="mt-5 font-semibold text-slate-200">
                      {review.title}
                    </h3>
                  )}

                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                    {review.comment}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setOpenReviewId((current) =>
                        current === review.id ? null : review.id
                      )
                    }
                    className="mt-5 inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-300 hover:bg-emerald-500/20"
                  >
                    <MessageCircle size={16} />
                    {openReviewId === review.id
                      ? 'Close discussion'
                      : 'Open discussion'}
                    {openReviewId === review.id ? (
                      <ChevronUp size={16} />
                    ) : (
                      <ChevronDown size={16} />
                    )}
                  </button>

                  {openReviewId === review.id && (
                    <PrivateMessageThread
                      kind="review"
                      threadId={review.id}
                      viewerRole="landlord"
                      title="Private discussion with this reviewer"
                      emptyText="No private messages yet. Send a message if you need clarification about this review."
                    />
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
