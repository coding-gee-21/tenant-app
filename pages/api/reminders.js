import { supabaseAdmin } from '../../lib/supabaseServer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Find vacant properties with last_vacancy_update older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: properties, error } = await supabaseAdmin
      .from('properties')
      .select('id, title, landlord_id, last_vacancy_update, landlords!inner(whatsapp_number, full_name)')
      .eq('status', 'vacant')
      .lt('last_vacancy_update', sevenDaysAgo);

    if (error) throw error;

    // 2. For each property, send a reminder (here we just log, but you can integrate WhatsApp/email)
    const reminders = [];
    for (const prop of properties) {
      // Check if we already sent a reminder in the last 3 days to avoid spamming
      const { data: existing } = await supabaseAdmin
        .from('property_reminders')
        .select('id')
        .eq('property_id', prop.id)
        .gte('sent_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (existing && existing.length > 0) continue; // skip if recently reminded

      // Log the reminder
      await supabaseAdmin
        .from('property_reminders')
        .insert({
          property_id: prop.id,
          reminder_type: 'vacancy_update',
        });

      // Send reminder (example: via WhatsApp or email)
      // Here we'll just log to console, but you can integrate Twilio, SendGrid, etc.
      console.log(`Reminder sent to ${prop.landlords.full_name} (${prop.landlords.whatsapp_number}) for property: ${prop.title}`);

      reminders.push(prop.id);
    }

    res.status(200).json({ message: 'Reminders processed', count: reminders.length });
  } catch (err) {
    console.error('Reminder error:', err);
    res.status(500).json({ error: err.message });
  }
}