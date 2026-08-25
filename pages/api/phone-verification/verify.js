import crypto from 'crypto';
import { supabaseAdmin } from '../../../lib/supabaseServer';

function normalizeKenyanPhone(value) {
  const raw = String(value || '').trim().replace(/[\s()-]/g, '');

  if (/^07\d{8}$/.test(raw) || /^01\d{8}$/.test(raw)) {
    return `+254${raw.slice(1)}`;
  }

  if (/^254[17]\d{8}$/.test(raw)) {
    return `+${raw}`;
  }

  if (/^\+254[17]\d{8}$/.test(raw)) {
    return raw;
  }

  return null;
}

function hashOtp(code) {
  const secret = process.env.PHONE_OTP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return crypto.createHmac('sha256', secret).update(code).digest('hex');
}

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
  if (!user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const { data: profile, error: eligibilityError } = await supabaseAdmin
    .from('profiles')
    .select('role, landlord_status, phone_verified')
    .eq('id', user.id)
    .maybeSingle();

  if (eligibilityError) {
    return res.status(500).json({ error: 'Unable to check landlord eligibility.' });
  }

  const landlordEligible =
    profile?.role === 'landlord' ||
    profile?.role === 'admin' ||
    profile?.landlord_status === 'phone_pending';

  if (!landlordEligible) {
    return res.status(403).json({
      error: 'Phone verification is available only during landlord onboarding.'
    });
  }

  if (profile?.phone_verified) {
    return res.status(409).json({ error: 'This account already has a verified phone number.' });
  }

  const phoneNumber = normalizeKenyanPhone(req.body?.phoneNumber);
  const code = String(req.body?.code || '').trim();

  if (!phoneNumber || !/^\d{6}$/.test(code)) {
    return res.status(400).json({
      error: 'Enter the 6-digit code sent to your phone.'
    });
  }

  const { data: record, error: lookupError } = await supabaseAdmin
    .from('phone_verification_codes')
    .select('*')
    .eq('user_id', user.id)
    .eq('phone_number', phoneNumber)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    console.error('OTP lookup failed:', lookupError.message);
    return res.status(500).json({ error: 'Unable to verify the code right now.' });
  }

  if (!record) {
    return res.status(400).json({
      error: 'No active verification code was found. Request a new code.'
    });
  }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    await supabaseAdmin
      .from('phone_verification_codes')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', record.id);

    return res.status(400).json({
      error: 'That verification code has expired. Request a new one.'
    });
  }

  if ((record.attempts || 0) >= 5) {
    await supabaseAdmin
      .from('phone_verification_codes')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', record.id);

    return res.status(429).json({
      error: 'Too many incorrect attempts. Request a new code.'
    });
  }

  const matches = crypto.timingSafeEqual(
    Buffer.from(record.code_hash, 'hex'),
    Buffer.from(hashOtp(code), 'hex')
  );

  if (!matches) {
    await supabaseAdmin
      .from('phone_verification_codes')
      .update({ attempts: (record.attempts || 0) + 1 })
      .eq('id', record.id);

    return res.status(400).json({
      error: 'Invalid verification code.'
    });
  }

  const now = new Date().toISOString();

  const { data: updatedProfiles, error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      phone_number: phoneNumber,
      phone_verified: true,
      phone_verified_at: now
    })
    .eq('id', user.id)
    .select('id');

  if (profileError) {
    console.error('Profile phone verification update failed:', profileError.message);
    return res.status(500).json({ error: 'Phone verified, but the account record could not be updated.' });
  }

  if (!updatedProfiles || updatedProfiles.length === 0) {
    console.error('No profile row exists for user:', user.id);
    return res.status(500).json({ error: 'Your account profile could not be found. Please log out and register again.' });
  }

  // Landlords already use whatsapp_number in the current Chuka Rentals schema.
  // Keep that field synchronized with the verified contact number.
  const { error: landlordError } = await supabaseAdmin
    .from('landlords')
    .update({
      whatsapp_number: phoneNumber
    })
    .eq('id', user.id);

  if (landlordError) {
    console.warn('Landlord phone sync skipped:', landlordError.message);
  }

  await supabaseAdmin
    .from('phone_verification_codes')
    .update({ consumed_at: now })
    .eq('id', record.id);

  return res.status(200).json({
    success: true,
    phoneNumber,
    message: 'Phone number verified successfully.'
  });
}
