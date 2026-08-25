import crypto from 'crypto';
import { supabaseAdmin } from '../../../lib/supabaseServer';
import { sms } from '../../../lib/africasTalking';

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

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, landlord_status, phone_verified')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
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
  if (!phoneNumber) {
    return res.status(400).json({
      error: 'Enter a valid Kenyan mobile number, for example 0712345678 or +254712345678.'
    });
  }

  // Source guide recommends a 60-second resend delay and a maximum of
  // three requests per hour to control SMS abuse and cost.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount, error: countError } = await supabaseAdmin
    .from('phone_verification_codes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('phone_number', phoneNumber)
    .gte('created_at', oneHourAgo);

  if (countError) {
    console.error('OTP rate-limit lookup failed:', countError.message);
    return res.status(500).json({ error: 'Unable to start verification right now.' });
  }

  if ((recentCount || 0) >= 3) {
    return res.status(429).json({
      error: 'Too many verification requests. Please try again later.'
    });
  }

  const { data: latest } = await supabaseAdmin
    .from('phone_verification_codes')
    .select('created_at')
    .eq('user_id', user.id)
    .eq('phone_number', phoneNumber)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest && Date.now() - new Date(latest.created_at).getTime() < 60 * 1000) {
    return res.status(429).json({
      error: 'Please wait 60 seconds before requesting another code.'
    });
  }

  // Invalidate older unused codes for this user.
  await supabaseAdmin
    .from('phone_verification_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('consumed_at', null);

  const otp = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const { error: insertError } = await supabaseAdmin
    .from('phone_verification_codes')
    .insert({
      user_id: user.id,
      phone_number: phoneNumber,
      code_hash: hashOtp(otp),
      expires_at: expiresAt,
      attempts: 0
    });

  if (insertError) {
    console.error('OTP record creation failed:', insertError.message);
    return res.status(500).json({ error: 'Unable to create verification code.' });
  }

  try {
    const options = {
      to: [phoneNumber],
      message: `Chuka Rentals verification code: ${otp}. It expires in 5 minutes.`
    };

    if (process.env.AT_SENDER_ID) {
      options.senderId = process.env.AT_SENDER_ID;
    }

    await sms.send(options);

    return res.status(200).json({
      success: true,
      message: 'Verification code sent successfully.'
    });
  } catch (error) {
    console.error('Africa’s Talking SMS error:', error?.message || error);

    // Do not leave a usable OTP behind if the SMS provider rejected the send.
    await supabaseAdmin
      .from('phone_verification_codes')
      .update({ consumed_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('phone_number', phoneNumber)
      .eq('code_hash', hashOtp(otp))
      .is('consumed_at', null);

    return res.status(502).json({
      error: 'We could not send the verification SMS. Please try again.'
    });
  }
}
