import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { ShieldCheck, AlertTriangle, Loader2, LogIn } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const checkExistingSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (mounted) setLoading(false);
        return;
      }

      const response = await fetch('/api/admin/session', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (response.ok) {
        router.replace('/admin/dashboard');
        return;
      }

      if (mounted) {
        setError('This account is not authorized for the administrator portal.');
        setLoading(false);
      }
    };

    checkExistingSession();
    return () => { mounted = false; };
  }, [router]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setSigningIn(true);
    setError('');

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (loginError) throw loginError;
      if (!data?.session) throw new Error('Authentication succeeded, but no session was created.');

      const response = await fetch('/api/admin/session', {
        headers: { Authorization: `Bearer ${data.session.access_token}` }
      });

      const result = await response.json();

      if (!response.ok) {
        await supabase.auth.signOut();
        throw new Error(result.error || 'This account is not authorized for the administrator portal.');
      }

      await router.replace('/admin/dashboard');
    } catch (loginError) {
      setError(loginError.message || 'Unable to sign in.');
    } finally {
      setSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090B] text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 className="animate-spin" size={20} />
          Checking administrator session...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090B] text-white flex items-center justify-center p-5">
      <div className="w-full max-w-md">
        <div className="bg-[#18181B] border border-white/10 rounded-2xl p-7 shadow-2xl">
          <div className="flex flex-col items-center text-center mb-7">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
              <ShieldCheck className="text-blue-400" size={30} />
            </div>
            <h1 className="text-2xl font-bold">Chuka Rentals</h1>
            <h2 className="text-xl font-semibold mt-1">Administrator Portal</h2>
            <p className="text-gray-400 text-sm mt-2">
              Sign in to access the Chuka Rentals control centre.
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 p-4 flex gap-3 text-sm">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm text-gray-300 mb-2">Administrator email</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
                className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-blue-500/60"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-blue-500/60"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={signingIn}
              className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-3 font-semibold flex items-center justify-center gap-2"
            >
              {signingIn ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
              {signingIn ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/10 text-center text-xs text-gray-500">
            Authorized Chuka Rentals administrators only.
          </div>
        </div>
      </div>
    </div>
  );
}
