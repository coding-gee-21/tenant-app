import { supabaseAdmin } from '../../../lib/supabaseServer';

async function getAdminUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : null;

  if (!token) return null;

  const { data, error } =
    await supabaseAdmin.auth.getUser(token);

  if (error || !data?.user) return null;

  const allowedEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  let isAdmin = allowedEmails.includes(
    (data.user.email || '').toLowerCase()
  );

  if (!isAdmin) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle();

    isAdmin = profile?.role === 'admin';
  }

  return isAdmin ? data.user : null;
}

export default async function handler(req, res) {
  const admin = await getAdminUser(req);

  if (!admin) {
    return res.status(403).json({
      error: 'Admin access required.'
    });
  }

  if (req.method === 'GET') {
    const { status = 'pending' } = req.query;

    let query = supabaseAdmin
      .from('property_reports')
      .select(`
        *,
        properties (
          id,
          title,
          landmark,
          semester_rent,
          listing_status,
          verification_status,
          is_verified,
          is_flagged,
          flag_reason,
          flagged_at
        )
      `)
      .order('created_at', {
        ascending: false
      });

    if (status !== 'all') {
      query = query.eq('admin_status', status);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({
        error: error.message
      });
    }

    return res.status(200).json({
      reports: data || []
    });
  }

  if (req.method !== 'PATCH') {
    return res.status(405).json({
      error: 'Method not allowed.'
    });
  }

  const {
    reportId,
    propertyId,
    action
  } = req.body || {};

  if (
    !reportId ||
    !propertyId ||
    !['clear', 'reverify', 'suspend'].includes(action)
  ) {
    return res.status(400).json({
      error: 'Valid report, property and action are required.'
    });
  }

  const now = new Date().toISOString();

  if (action === 'clear') {
    const { error: propertyError } = await supabaseAdmin
      .from('properties')
      .update({
        is_flagged: false,
        flag_reason: null,
        flagged_at: null
      })
      .eq('id', propertyId);

    if (propertyError) {
      return res.status(500).json({
        error: propertyError.message
      });
    }
  }

  if (action === 'reverify') {
    const { error: propertyError } = await supabaseAdmin
      .from('properties')
      .update({
        is_flagged: true,
        verification_status: 'pending',
        is_verified: false
      })
      .eq('id', propertyId);

    if (propertyError) {
      return res.status(500).json({
        error: propertyError.message
      });
    }
  }

  if (action === 'suspend') {
    const { error: propertyError } = await supabaseAdmin
      .from('properties')
      .update({
        is_flagged: true,
        listing_status: 'suspended',
        verification_status: 'suspended',
        is_verified: false
      })
      .eq('id', propertyId);

    if (propertyError) {
      return res.status(500).json({
        error: propertyError.message
      });
    }
  }

  const { error: reportError } = await supabaseAdmin
    .from('property_reports')
    .update({
      admin_status:
        action === 'clear'
          ? 'cleared'
          : action === 'suspend'
          ? 'suspended'
          : 'reverification',
      reviewed_at: now,
      reviewed_by: admin.id
    })
    .eq('id', reportId);

  if (reportError) {
    return res.status(500).json({
      error: reportError.message
    });
  }

  return res.status(200).json({
    success: true
  });
}