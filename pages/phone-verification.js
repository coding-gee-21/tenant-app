import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { CheckCircle2, ShieldCheck, Smartphone } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function PhoneVerification() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('phone');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    let timer;

    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      if (!session) {
        router.replace('/auth');
        return;
      }

      const response = await fetch('/api/phone-verification/status', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const data = await response.json();

      if (response.ok) {
        setPhoneNumber(data.phoneNumber || '');
        setVerified(Boolean(data.phoneVerified));
        if (data.phoneVerified) setStep('verified');
      }

      setLoading(false);
    };

    init();

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [router]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const getSession = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data?.session) throw new Error('Your session has expired. Please log in again.');
    return data.session;
  };

  const sendCode = async () => {
    setSending(true);
    setError('');
    setMessage('');

    try {
      const session = await getSession();
      const response = await fetch('/api/phone-verification/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ phoneNumber })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not send the verification code.');

      setStep('code');
      setCooldown(60);
      setMessage('Verification code sent. Check your phone.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const verifyCode = async (e) => {
    e.preventDefault();
    setVerifying(true);
    setError('');
    setMessage('');

    try {
      const session = await getSession();
      const response = await fetch('/api/phone-verification/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ phoneNumber, code })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Verification failed.');

      setVerified(true);
      setStep('verified');
      setMessage('Your phone number is now verified.');

      const returnTo = typeof router.query.returnTo === 'string' ? router.query.returnTo : '';
      if (returnTo && returnTo.startsWith('/')) {
        setTimeout(() => router.replace(returnTo), 900);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#09090B] text-gray-400 flex items-center justify-center">Loading phone verification...</div>;
  }

  return (
    <div className="min-h-screen bg-[#09090B] text-white px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-lg bg-[#18181B] border border-white/10 rounded-3xl p-7 md:p-9 shadow-2xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <ShieldCheck className="text-blue-400" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Verify your phone</h1>
            <p className="text-sm text-gray-400">Secure your Chuka Rentals account.</p>
          </div>
        </div>

        <p className="text-sm text-gray-400 leading-relaxed mt-5">
          We will send a one-time 6-digit code by SMS. The code expires after 5 minutes.
        </p>

        {message && (
          <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 p-3 text-sm">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 p-3 text-sm">
            {error}
          </div>
        )}

        {step === 'verified' || verified ? (
          <div className="mt-7 space-y-5">
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <CheckCircle2 className="text-emerald-400" />
              <div>
                <p className="font-semibold text-emerald-300">Phone verified</p>
                <p className="text-sm text-gray-300">{phoneNumber}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={typeof router.query.returnTo === 'string' && router.query.returnTo.startsWith('/') ? router.query.returnTo : '/account'}
                className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold"
              >
                {typeof router.query.returnTo === 'string' && router.query.returnTo.startsWith('/') ? 'Continue' : 'Go to Dashboard'}
              </Link>
              <Link href="/" className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 font-semibold">
                Back to Home
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-7 space-y-5">
            <label className="block text-sm font-medium text-gray-300">
              Kenyan mobile number
              <div className="relative mt-2">
                <Smartphone className="absolute left-3 top-3.5 text-gray-500" size={18} />
                <input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="0712345678"
                  className="w-full bg-[#101012] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-blue-500"
                  disabled={step === 'code'}
                />
              </div>
            </label>

            {step === 'phone' ? (
              <button
                type="button"
                onClick={sendCode}
                disabled={sending || !phoneNumber.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-3.5 rounded-xl font-semibold"
              >
                {sending ? 'Sending code...' : 'Send Verification Code'}
              </button>
            ) : (
              <form onSubmit={verifyCode} className="space-y-4">
                <label className="block text-sm font-medium text-gray-300">
                  6-digit verification code
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="mt-2 w-full bg-[#101012] border border-white/10 rounded-xl px-4 py-3 text-white tracking-[0.35em] text-center text-lg focus:outline-none focus:border-blue-500"
                  />
                </label>

                <button
                  type="submit"
                  disabled={verifying || code.length !== 6}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-3.5 rounded-xl font-semibold"
                >
                  {verifying ? 'Verifying...' : 'Verify Phone Number'}
                </button>

                <button
                  type="button"
                  onClick={sendCode}
                  disabled={sending || cooldown > 0}
                  className="w-full bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-40 py-3 rounded-xl text-sm font-medium"
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : sending ? 'Sending...' : 'Resend Code'}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep('phone'); setError(''); setMessage(''); }}
                  className="w-full text-sm text-gray-400 hover:text-white"
                >
                  Change phone number
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
