import { supabaseAdmin } from '../../../lib/supabaseServer';

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });

  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ error: 'Invalid or expired session.' });

  const user = data.user;
  const email = (user.email || '').toLowerCase();
  const allowedEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  let role = null;
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle();

  if (!profileError) role = profile?.role || null;

  const isAdmin = allowedEmails.includes(email) || role === 'admin';

  if (!isAdmin) {
    return res.status(403).json({ error: 'This account is not authorized for the administrator portal.' });
  }

  return res.status(200).json({
    isAdmin: true,
    user: {
      id: user.id,
      email: user.email,
      fullName: profile?.full_name || ''
    }
  });
}
