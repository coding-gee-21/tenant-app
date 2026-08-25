import { useState } from 'react';
import { CalendarDays, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useToast } from './Toast';

export default function ViewingRequestModal({ property, user, onClose }) {
  const [date, setDate] = useState('');
  const [period, setPeriod] = useState('afternoon');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const submit = async (event) => {
    event.preventDefault();
    if (!user) { window.location.href = `/auth?returnTo=/properties/${property.id}`; return; }
    const landlordId = property.user_id || property.landlord_id;
    setLoading(true);
    const { error } = await supabase.from('viewing_requests').insert({ property_id: property.id, student_id: user.id, landlord_id: landlordId, preferred_date: date, preferred_period: period, message: message.trim() || null });
    setLoading(false);
    if (error) { showToast(error.code === '23505' ? 'You already have an active viewing request for this property.' : error.message, 'error'); return; }
    showToast('Viewing request sent to the property manager.');
    onClose();
  };
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"><form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-2xl border border-white/10 bg-[#18181B] p-6 text-white shadow-2xl"><div className="flex justify-between"><div><h2 className="flex items-center gap-2 text-xl font-bold"><CalendarDays className="text-blue-400" /> Request a viewing</h2><p className="mt-1 text-sm text-gray-400">{property.title}</p></div><button type="button" onClick={onClose} aria-label="Close"><X /></button></div><div><label className="mb-2 block text-sm text-gray-300">Preferred date</label><input required type="date" min={new Date().toISOString().split('T')[0]} value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#101013] p-3" /></div><div><label className="mb-2 block text-sm text-gray-300">Preferred time</label><select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#101013] p-3"><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option></select></div><div><label className="mb-2 block text-sm text-gray-300">Message (optional)</label><textarea rows="3" maxLength="500" value={message} onChange={(e) => setMessage(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#101013] p-3" placeholder="Ask anything the landlord should prepare for the viewing." /></div><button disabled={loading} className="w-full rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50">{loading ? 'Sending…' : 'Send viewing request'}</button></form></div>;
}
