import { supabaseAdmin } from '../../../lib/supabaseServer';

async function getAdminUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;

  const allowedEmails = (process.env.ADMIN_EMAILS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  let isAdmin = allowedEmails.includes((data.user.email || '').toLowerCase());
  if (!isAdmin) {
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
    isAdmin = profile?.role === 'admin';
  }
  return isAdmin ? data.user : null;
}

export default async function handler(req, res) {
  const admin = await getAdminUser(req);
  if (!admin) return res.status(403).json({ error: 'Admin access required.' });

  if (req.method === 'GET') {
    const { status = 'pending' } = req.query;
    let query = supabaseAdmin.from('properties').select('*').order('created_at', { ascending: false });
    if (status !== 'all') query = query.eq('listing_status', status);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ properties: data || [] });
  }

  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed.' });

  const { id, decision } = req.body || {};
  if (!id || !['approved', 'rejected', 'suspended'].includes(decision)) return res.status(400).json({ error: 'Property ID and valid decision are required.' });

  let updates = {
    listing_status: decision
  };

  if (decision === 'approved') {
    updates = {
      ...updates,
      is_verified: true,
      verification_status: 'verified'
    };
  }

  if (decision === 'rejected') {
    updates = {
      ...updates,
      is_verified: false,
      verification_status: 'rejected'
    };
  }

  if (decision === 'suspended') {
    updates = {
      ...updates,
      is_verified: false,
      verification_status: 'suspended'
    };
  }

  const { error } = await supabaseAdmin.from('properties').update(updates).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
}
