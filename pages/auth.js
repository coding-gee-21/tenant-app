import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';

export default function Auth() {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const destination = typeof router.query.returnTo === 'string' && router.query.returnTo.startsWith('/')
    ? router.query.returnTo
    : '/';

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'forgot') {
        const redirectTo = `${window.location.origin}/update-password`;
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo,
        });

        if (resetError) throw resetError;

        alert('Password reset link sent! Check your email inbox.');
        setMode('login');
      } else if (mode === 'register') {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
            emailRedirectTo: `${window.location.origin}/auth?confirmed=1&returnTo=` + encodeURIComponent(destination),
          },
        });

        if (authError) {
          if (authError.status === 422 || authError.message.toLowerCase().includes('already registered')) {
            alert('This email is already registered. Please log in.');
            setMode('login');
            setLoading(false);
            return;
          }
          throw authError;
        }

        if (authData.session) {
          alert('Registration successful. Your email is already confirmed.');
          router.push(destination);
        } else {
          alert('Account created. Check your email and click the confirmation link before logging in.');
          setMode('login');
        }
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (loginError) throw loginError;

        router.push(destination);
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="max-w-md w-full bg-gray-800 p-8 rounded-lg shadow-lg space-y-6">
        <h2 className="text-2xl font-bold text-center">
          {mode === 'register'
            ? 'Create Your Account'
            : mode === 'forgot'
            ? 'Reset Your Password'
            : 'Welcome Back'}
        </h2>

        <form onSubmit={handleAuth} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-300">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white p-2 border"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white p-2 border"
            />
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-gray-300">Password</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-xs text-blue-400 hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative mt-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="block w-full rounded-md bg-gray-700 border-gray-600 text-white p-2 pr-16 border"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-xs text-gray-400 hover:text-white"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 disabled:opacity-50 font-semibold"
          >
            {loading
              ? 'Processing...'
              : mode === 'register'
              ? 'Sign Up'
              : mode === 'forgot'
              ? 'Send Reset Link'
              : 'Log In'}
          </button>
        </form>

        <div className="text-center text-sm space-y-2">
          {mode === 'forgot' ? (
            <button
              type="button"
              onClick={() => setMode('login')}
              className="text-blue-400 hover:underline"
            >
              Back to Log in
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-blue-400 hover:underline"
            >
              {mode === 'login'
                ? "Don't have an account? Register"
                : 'Already have an account? Log in'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
