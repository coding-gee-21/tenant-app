import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Star } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAccount } from '../../lib/useAccount';

export default function MyReviews() {
  const router = useRouter();
  const { user, loading } = useAccount();
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?returnTo=/account/reviews');
    if (!user) return;
    supabase.from('reviews').select('id, property_id, rating, comment, created_at, properties(title)').eq('user_id', user.id).order('created_at', { ascending: false }).then(({ data }) => setReviews(data || []));
  }, [loading, user, router]);

  return <div className="max-w-3xl mx-auto text-white space-y-5"><div><Link href="/account" className="text-blue-400 text-sm">← Account</Link><h1 className="text-3xl font-bold mt-2">Your property reviews</h1></div>{reviews.length === 0 ? <div className="rounded-2xl border border-white/10 bg-[#18181B] p-8 text-gray-400">You have not reviewed a property yet.</div> : reviews.map((review) => <Link key={review.id} href={`/properties/${review.property_id}`} className="block rounded-2xl border border-white/10 bg-[#18181B] p-5 hover:border-blue-500/40"><div className="flex justify-between gap-4"><strong>{review.properties?.title || 'Property'}</strong><span className="flex items-center gap-1 text-amber-400"><Star size={16} fill="currentColor" />{review.rating}</span></div><p className="mt-2 text-gray-300">{review.comment}</p></Link>)}</div>;
}
