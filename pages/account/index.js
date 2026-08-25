import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Bookmark, Building2, CheckCircle2, MailWarning, MessageSquare, User, Bell, CalendarDays, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAccount } from '../../lib/useAccount';

export default function StudentAccount() {
  const router = useRouter();
  const { user, profile, emailVerified, loading } = useAccount();
  const [counts, setCounts] = useState({ reviews: 0, saved: 0 });

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?returnTo=/account');
    if (!user) return;
    Promise.all([
      supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('bookmarks').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
    ]).then(([reviews, saved]) => setCounts({ reviews: reviews.count || 0, saved: saved.count || 0 }));
  }, [loading, user, router]);

  if (loading || !user) return <div className="p-16 text-center text-gray-400">Loading your account…</div>;

  return (
    <div className="max-w-4xl mx-auto text-white space-y-7">
      <div className="rounded-2xl border border-white/10 bg-[#18181B] p-7 flex items-center gap-5">
        <div className="rounded-full bg-blue-500/15 p-4"><User className="text-blue-400" /></div>
        <div><h1 className="text-2xl font-bold">{profile?.full_name || 'Student account'}</h1><p className="text-gray-400">{user.email}</p></div>
      </div>
      {emailVerified ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
          <CheckCircle2 /> Email verified - you can publish property reviews.
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
          <MailWarning /> Verify your email before publishing property reviews.
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        <Link href="/account/reviews" className="rounded-2xl border border-white/10 bg-[#18181B] p-6 hover:border-blue-500/40"><MessageSquare className="text-blue-400" /><p className="mt-3 text-xl font-bold">{counts.reviews}</p><p className="text-gray-400">Your reviews</p></Link>
        <Link href="/account/saved" className="rounded-2xl border border-white/10 bg-[#18181B] p-6 hover:border-amber-500/40"><Bookmark className="text-amber-400" /><p className="mt-3 text-xl font-bold">{counts.saved}</p><p className="text-gray-400">Saved properties</p></Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-3"><Link href="/account/searches" className="rounded-2xl border border-white/10 bg-[#18181B] p-5 hover:border-blue-500/40"><Bell className="text-blue-400"/><p className="mt-3 font-semibold">Saved searches</p></Link><Link href="/account/viewings" className="rounded-2xl border border-white/10 bg-[#18181B] p-5 hover:border-blue-500/40"><CalendarDays className="text-emerald-400"/><p className="mt-3 font-semibold">Viewing requests</p></Link><Link href="/safety" className="rounded-2xl border border-white/10 bg-[#18181B] p-5 hover:border-blue-500/40"><ShieldCheck className="text-amber-400"/><p className="mt-3 font-semibold">Safety centre</p></Link></div>
      <Link href="/landlord" className="flex items-center justify-between rounded-2xl border border-blue-500/20 bg-blue-500/10 p-6 hover:bg-blue-500/15"><span><strong>Own or manage accommodation?</strong><span className="block text-sm text-gray-300 mt-1">Open the separate landlord portal.</span></span><Building2 className="text-blue-400" /></Link>
    </div>
  );
}
