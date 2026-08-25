import { supabaseAdmin } from '../../../lib/supabaseServer';

async function getAdminUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return { error: 'Authentication required.' };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return { error: 'Invalid or expired session.' };

  const allowedEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  let isAdmin = allowedEmails.includes((data.user.email || '').toLowerCase());

  if (!isAdmin) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle();
    isAdmin = profile?.role === 'admin';
  }

  if (!isAdmin) return { error: 'Admin access required.' };
  return { user: data.user };
}

export default async function handler(req, res) {
  const auth = await getAdminUser(req);
  if (auth.error) return res.status(403).json({ error: auth.error });

  if (req.method === 'GET') {
    const { status = 'pending' } = req.query;
    let query = supabaseAdmin.from('verification_requests').select('*').order('submitted_at', { ascending: false });
    if (status !== 'all') query = query.eq('status', status);

    const { data: requests, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const landlordIds = [...new Set((requests || []).map((r) => r.landlord_id).filter(Boolean))];
    const propertyIds = [...new Set((requests || []).map((r) => r.property_id).filter(Boolean))];
    const [{ data: landlords }, { data: properties }] = await Promise.all([
      landlordIds.length ? supabaseAdmin.from('landlords').select('id, full_name, email, whatsapp_number, verification_status').in('id', landlordIds) : Promise.resolve({ data: [] }),
      propertyIds.length ? supabaseAdmin.from('properties').select('id, title, landmark, semester_rent, images, status, is_verified, verification_status').in('id', propertyIds) : Promise.resolve({ data: [] })
    ]);
    const landlordMap = Object.fromEntries((landlords || []).map((item) => [item.id, item]));
    const propertyMap = Object.fromEntries((properties || []).map((item) => [item.id, item]));
    const enriched = (requests || []).map((request) => ({ ...request, landlords: landlordMap[request.landlord_id] || null, properties: request.property_id ? (propertyMap[request.property_id] || null) : null }));
    return res.status(200).json({ requests: enriched });
  }

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { id, decision, rejection_reason = '', notes = '' } = req.body || {};
  if (!id || !['approved', 'rejected', 'suspended'].includes(decision)) {
    return res.status(400).json({ error: 'Request ID and a valid decision are required.' });
  }

  const { data: request, error: requestError } = await supabaseAdmin
    .from('verification_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (requestError || !request) return res.status(404).json({ error: 'Verification request not found.' });
  if (request.status !== 'pending') return res.status(409).json({ error: 'This request has already been reviewed.' });

  const now = new Date();
  const expiresAt = decision === 'approved'
    ? new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { error: updateRequestError } = await supabaseAdmin
    .from('verification_requests')
    .update({
      status: decision,
      rejection_reason: decision === 'approved' ? null : (rejection_reason.trim() || 'Verification requirements were not satisfied.'),
      notes: notes.trim() || request.notes || null,
      reviewed_at: now.toISOString(),
      reviewed_by: auth.user.id,
      expires_at: expiresAt
    })
    .eq('id', id);

  if (updateRequestError) return res.status(500).json({ error: updateRequestError.message });

  const verificationStatus = decision;
  const targetTable = request.verification_type === 'landlord' ? 'landlords' : 'properties';
  const targetId = request.verification_type === 'landlord' ? request.landlord_id : request.property_id;

  const targetUpdate = {
    verification_status: verificationStatus,
    verification_rejection_reason: decision === 'approved' ? null : (rejection_reason.trim() || 'Verification requirements were not satisfied.'),
    verified_at: decision === 'approved' ? now.toISOString() : null,
    verification_expires_at: expiresAt
  };

  if (request.verification_type === 'landlord') {
    // Keep legacy fields synchronized for existing UI/components.
    targetUpdate.is_verified = decision === 'approved';
  }

  if (request.verification_type === 'property') {
    targetUpdate.is_verified = decision === 'approved';
  }

  const { error: targetError } = await supabaseAdmin
    .from(targetTable)
    .update(targetUpdate)
    .eq('id', targetId);

  if (targetError) return res.status(500).json({ error: targetError.message });

  return res.status(200).json({ success: true });
}
