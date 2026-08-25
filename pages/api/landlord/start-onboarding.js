import { supabaseAdmin } from '../../../lib/supabaseServer';

async function getAuthenticatedUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });

  if (!user.email_confirmed_at && !user.confirmed_at) {
    return res.status(403).json({ error: 'Verify your email before becoming a landlord.' });
  }

  const { data: profile, error: lookupError } = await supabaseAdmin
    .from('profiles')
    .select('role, landlord_status, phone_verified')
    .eq('id', user.id)
    .maybeSingle();

  if (lookupError || !profile) {
    return res.status(500).json({ error: 'Your account profile could not be loaded.' });
  }

  if (profile.role === 'landlord' || profile.role === 'admin' || profile.phone_verified) {
    return res.status(200).json({ success: true });
  }

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ landlord_status: 'phone_pending' })
    .eq('id', user.id);

  if (updateError) {
    return res.status(500).json({ error: 'Unable to begin landlord onboarding.' });
  }

  return res.status(200).json({ success: true });
}
