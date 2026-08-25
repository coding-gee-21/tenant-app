import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAccount } from '../lib/useAccount';

export default function DashboardRedirect() {
  const router = useRouter();
  const { profile, loading } = useAccount();

  useEffect(() => {
    if (loading) return;
    router.replace(profile?.role === 'landlord' || profile?.role === 'admin' ? '/landlord/dashboard' : '/account');
  }, [loading, profile, router]);

  return <div className="p-16 text-center text-gray-400">Opening your account…</div>;
}
