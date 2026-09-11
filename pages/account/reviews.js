import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Star,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAccount } from '../../lib/useAccount';
import PrivateMessageThread from '../../components/PrivateMessageThread';

export default function MyReviews() {
  const router = useRouter();
  const { user, loading: accountLoading } = useAccount();
  const [reviews, setReviews] = useState([]);
  const [openReviewId, setOpenReviewId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!accountLoading && !user) {
      router.replace('/auth?returnTo=/account/reviews');
      return;
    }

    if (!user) return;

    let cancelled = false;

    async function loadReviews() {
      setLoading(true);
      setErrorMessage('');

      const { data, error } = await supabase
        .from('reviews')
        .select(
          'id, property_id, rating, title, comment, status, created_at, properties(title)'
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error('Unable to load review history:', error);
        setErrorMessage(
          error.message || 'Unable to load your reviews.'
        );
      } else {
        setReviews(data || []);
      }

      setLoading(false);
    }

    loadReviews();

    return () => {
      cancelled = true;
    };
  }, [accountLoading, router, user]);

  return (
    <>
      <Head>
        <title>Your Reviews | Chuka Rentals</title>
      </Head>

      <main className="min-h-screen bg-[#111214] px-5 py-10 text-white">
        <section className="mx-auto max-w-4xl space-y-5">
          <div>
            <Link
              href="/account"
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              ← Account
            </Link>

            <h1 className="mt-2 text-3xl font-bold">
              Your property reviews
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Open a private discussion to exchange follow-up messages
              with the property manager.
            </p>
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              {errorMessage}
            </div>
          )}

          {accountLoading || loading ? (
            <div className="rounded-2xl border border-white/10 bg-[#18181B] p-8 text-slate-400">
              Loading your reviews...
            </div>
          ) : reviews.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#18181B] p-8 text-slate-400">
              You have not reviewed a property yet.
            </div>
          ) : (
            reviews.map((review) => (
              <article
                key={review.id}
                className="rounded-2xl border border-white/10 bg-[#18181B] p-5"
              >
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <Link
                      href={`/properties/${review.property_id}`}
                      className="font-bold text-white hover:text-blue-300"
                    >
                      {review.properties?.title || 'Property'}
                    </Link>

                    {review.title && (
                      <p className="mt-2 text-sm font-semibold text-slate-200">
                        {review.title}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 text-amber-400">
                      <Star size={16} fill="currentColor" />
                      {review.rating}
                    </span>

                    {review.status && (
                      <span className="ml-3 rounded-full border border-white/10 px-2 py-1 text-[11px] capitalize text-slate-400">
                        {review.status}
                      </span>
                    )}
                  </div>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                  {review.comment}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setOpenReviewId((current) =>
                      current === review.id ? null : review.id
                    )
                  }
                  className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-300 hover:bg-emerald-500/20"
                >
                  <MessageCircle size={16} />
                  {openReviewId === review.id
                    ? 'Close private discussion'
                    : 'Open private discussion'}
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
                    viewerRole="student"
                    title="Private discussion with property management"
                    emptyText="No private messages yet. Send a follow-up if you need to discuss your review with the property manager."
                  />
                )}
              </article>
            ))
          )}
        </section>
      </main>
    </>
  );
}
