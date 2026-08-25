import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Building2, CheckCircle, Phone, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAccount } from '../../lib/useAccount';

export default function LandlordPortal() {
  const router = useRouter();
  const { user, profile, loading } = useAccount();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && profile?.role === 'landlord') router.replace('/landlord/dashboard');
  }, [loading, profile, router]);

  const becomeLandlord = async () => {
    if (!user) {
      router.push('/auth?returnTo=/landlord');
      return;
    }

    if (!user.email_confirmed_at && !user.confirmed_at) {
      alert('Verify your email before opening the landlord portal.');
      return;
    }

    if (!profile?.phone_verified) {
      setSubmitting(true);

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/landlord/start-onboarding', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token || ''}`
        }
      });
      const data = await response.json();
      setSubmitting(false);

      if (!response.ok) {
        alert(data.error || 'Unable to start landlord verification.');
        return;
      }

      router.push('/phone-verification?returnTo=/landlord');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc('become_landlord');
    setSubmitting(false);
    if (error) {
      alert(error.message);
      return;
    }
    router.push('/landlord/dashboard');
  };

  return (
    <div className="max-w-4xl mx-auto text-white space-y-8">
      <div className="rounded-3xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-transparent p-8 md:p-12">
        <Building2 className="text-blue-400 mb-5" size={42} />
        <h1 className="text-3xl md:text-4xl font-bold">Landlord Portal</h1>
        <p className="mt-4 max-w-2xl text-gray-300">List accommodation, update vacancies and respond to student interest from a workspace designed only for property owners and managers.</p>
        <button onClick={becomeLandlord} disabled={loading || submitting} className="mt-7 rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50">
          {!user ? 'Log in to continue' : !profile?.phone_verified ? 'Verify phone to continue' : submitting ? 'Setting up portal…' : 'Become a Landlord'}
        </button>
        {user && <Link href="/account" className="ml-4 text-sm text-gray-400 hover:text-white">Return to student account</Link>}
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {[['Phone verification', Phone], ['Separate dashboard', ShieldCheck], ['Managed listings', CheckCircle]].map(([label, Icon]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-[#18181B] p-5"><Icon className="text-emerald-400" /><p className="mt-3 font-semibold">{label}</p></div>
        ))}
      </div>
    </div>
  );
}
