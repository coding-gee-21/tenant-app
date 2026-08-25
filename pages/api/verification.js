import { supabaseAdmin } from '../../lib/supabaseServer';

async function getAuthenticatedUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export default async function handler(req, res) {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('verification_requests')
      .select('*')
      .eq('landlord_id', user.id)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ requests: data || [] });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const {
    verification_type,
    property_id = null,
    full_name,
    phone_number,
    role,
    notes = ''
  } = req.body || {};

  if (!['landlord', 'property'].includes(verification_type)) {
    return res.status(400).json({ error: 'Invalid verification type.' });
  }

  if (!full_name?.trim() || !phone_number?.trim()) {
    return res.status(400).json({ error: 'Full name and phone number are required.' });
  }

  await supabaseAdmin.from('landlords').upsert({ id: user.id, email: user.email, full_name: full_name.trim() }, { onConflict: 'id' });

  // Ensure the landlord profile exists for the verification foreign key.
  await supabaseAdmin
    .from('landlords')
    .upsert({ id: user.id, email: user.email, full_name: full_name.trim() }, { onConflict: 'id' });

  if (verification_type === 'property') {
    if (!property_id) return res.status(400).json({ error: 'Property ID is required.' });

    const { data: property, error: propertyError } = await supabaseAdmin
      .from('properties')
      .select('id, landlord_id, user_id, title, verification_status')
      .eq('id', property_id)
      .maybeSingle();

    if (propertyError) return res.status(500).json({ error: propertyError.message });
    if (!property) return res.status(404).json({ error: 'Property not found.' });
    if (property.landlord_id !== user.id && property.user_id !== user.id) {
      return res.status(403).json({ error: 'You can only verify your own property.' });
    }
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('verification_requests')
    .select('id, status')
    .eq('landlord_id', user.id)
    .eq('verification_type', verification_type)
    .eq('status', 'pending')
    .maybeSingle();

  if (existingError) return res.status(500).json({ error: existingError.message });
  if (existing && verification_type === 'landlord') {
    return res.status(409).json({ error: 'You already have a landlord verification request under review.' });
  }

  if (verification_type === 'property') {
    const { data: propertyPending } = await supabaseAdmin
      .from('verification_requests')
      .select('id')
      .eq('property_id', property_id)
      .eq('verification_type', 'property')
      .eq('status', 'pending')
      .maybeSingle();
    if (propertyPending) {
      return res.status(409).json({ error: 'This property already has a verification request under review.' });
    }
  }

  const { data: request, error } = await supabaseAdmin
    .from('verification_requests')
    .insert({
      landlord_id: user.id,
      property_id: verification_type === 'property' ? property_id : null,
      verification_type,
      status: 'pending',
      full_name: full_name.trim(),
      phone_number: phone_number.trim(),
      role: role?.trim() || null,
      notes: notes?.trim() || null,
      submitted_at: new Date().toISOString()
    })
    .select('*')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Mirror workflow state onto the target record.
  const table = verification_type === 'landlord' ? 'landlords' : 'properties';
  const targetId = verification_type === 'landlord' ? user.id : property_id;
  const { error: targetError } = await supabaseAdmin
    .from(table)
    .update({
      verification_status: 'pending',
      verification_submitted_at: new Date().toISOString(),
      verification_rejection_reason: null
    })
    .eq('id', targetId);

  if (targetError) {
    console.error('Verification target update failed:', targetError.message);
  }

  return res.status(201).json({ request });
}
