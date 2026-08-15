import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMessage('You can now set a new password.');
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Password updated successfully! Redirecting...');
      setTimeout(() => {
        router.push('/auth');
      }, 1500);
    }
  };

  return (
    <div className="bg-[#181818] min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center gap-2 mb-6">
          <span className="w-3 h-3 rounded-full bg-[#C41E24]"></span>
          <span className="w-3 h-3 rounded-full bg-[#4da6ff]"></span>
          <span className="w-3 h-3 rounded-full bg-[#1B7A34]"></span>
        </div>

        <div className="bg-[#1c1c1c] border border-[#333333] p-8 rounded-xl">
          <h1 className="text-2xl font-bold text-center text-white mb-1">
            Set New Password
          </h1>
          <p className="text-center text-sm text-[#8f9aa6] mb-6">
            Enter your new password below.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#cccccc] mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#242424] border border-[#383838] rounded-lg px-3 py-2 pr-16 text-white placeholder-[#666] focus:outline-none focus:ring-2 focus:ring-[#4da6ff]/40 focus:border-[#4da6ff]"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#4da6ff] hover:text-[#3a8fe0] bg-transparent border-none cursor-pointer font-medium"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#cccccc] mb-1">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[#242424] border border-[#383838] rounded-lg px-3 py-2 pr-16 text-white placeholder-[#666] focus:outline-none focus:ring-2 focus:ring-[#4da6ff]/40 focus:border-[#4da6ff]"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#4da6ff] hover:text-[#3a8fe0] bg-transparent border-none cursor-pointer font-medium"
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#4da6ff] hover:bg-[#3a8fe0] text-[#121212] font-bold py-2.5 rounded-lg disabled:opacity-50 transition"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>

          {message && (
            <p className={`mt-4 text-center text-sm ${message.includes('successfully') || message.includes('can now') ? 'text-emerald-400' : 'text-red-400'}`}>
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
