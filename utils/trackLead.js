import { supabase } from '../lib/supabaseClient';

export async function handleWhatsAppClick(propertyId, whatsappNumber) {
  try {
    const { data: property, error: fetchError } = await supabase
      .from('properties')
      .select('leads')
      .eq('id', propertyId)
      .single();

    if (!fetchError && property) {
      const currentLeads = property.leads || 0;
      await supabase
        .from('properties')
        .update({ leads: currentLeads + 1 })
        .eq('id', propertyId);
    }
  } catch (err) {
    console.error('Error tracking lead:', err);
  }

  const cleanPhone = whatsappNumber.replace(/[^0-9]/g, '');
  window.open(`https://wa.me/${cleanPhone}`, '_blank');
}
