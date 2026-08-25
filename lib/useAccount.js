import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export function useAccount() {
  const [account, setAccount] = useState({
    user: null,
    profile: null,
    emailVerified: false,
    loading: true
  });

  useEffect(() => {
    let active = true;

    const load = async (session) => {
      const user = session?.user ?? null;
      if (!user) {
        if (active) {
          setAccount({ user: null, profile: null, emailVerified: false, loading: false });
        }
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role, landlord_status, phone_verified, student_verified')
        .eq('id', user.id)
        .maybeSingle();

      if (active) {
        setAccount({
          user,
          profile: profile || null,
          emailVerified: Boolean(user.email_confirmed_at || user.confirmed_at),
          loading: false
        });
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => load(session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => load(session));

    return () => {
      active = false;
      data?.subscription.unsubscribe();
    };
  }, []);

  return account;
}
