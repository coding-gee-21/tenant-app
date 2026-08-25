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
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('phone_number, phone_verified, phone_verified_at, role, landlord_status')
    .eq('id', user.id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({
    phoneNumber: data?.phone_number || '',
    phoneVerified: Boolean(data?.phone_verified),
    phoneVerifiedAt: data?.phone_verified_at || null,
    landlordEligible: Boolean(
      data?.role === 'landlord' ||
      data?.role === 'admin' ||
      data?.landlord_status === 'phone_pending'
    )
  });
}
