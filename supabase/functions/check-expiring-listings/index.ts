import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  // 1. Fetch properties expiring within 7 days
  const { data: expiringSoon, error: fetchError } = await supabase
    .from('properties')
    .select('id, user_id, title, expires_at')
    .lte('expires_at', sevenDaysFromNow.toISOString())
    .gt('expires_at', now.toISOString())
    .eq('status', 'available');

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
  }

  // 2. Insert warning notifications for expiring listings
  if (expiringSoon && expiringSoon.length > 0) {
    for (const prop of expiringSoon) {
      if (prop.user_id) {
        await supabase.from('notifications').insert({
          landlord_id: prop.user_id,
          title: 'Listing Expiration Warning',
          message: `Your listing "${prop.title}" expires on ${new Date(prop.expires_at).toLocaleDateString()}. Please renew via M-Pesa.`,
          type: 'expiration_warning'
        });
      }
    }
  }

  // 3. Auto-archive listings past their expiration date
  const { error: archiveError } = await supabase
    .from('properties')
    .update({ status: 'archived' })
    .lt('expires_at', now.toISOString());

  if (archiveError) {
    return new Response(JSON.stringify({ error: archiveError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ 
    success: true, 
    checked_expiring: expiringSoon?.length || 0 
  }), { headers: { "Content-Type": "application/json" } });
})