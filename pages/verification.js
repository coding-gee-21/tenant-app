import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ShieldCheck, Clock3, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const statusStyles = {
  unverified: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/20',
  pending: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  verified: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  rejected: 'bg-red-500/10 text-red-300 border-red-500/20',
  suspended: 'bg-red-500/10 text-red-300 border-red-500/20'
};

export default function VerificationPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [landlord, setLandlord] = useState(null);
  const [properties, setProperties] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone_number: '', role: 'Property owner', notes: '' });
  const [propertyId, setPropertyId] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const currentUser = sessionData?.session?.user;
    if (!currentUser) {
      router.replace('/auth');
      return;
    }
    setUser(currentUser);

    const [{ data: landlordData }, { data: propertyData }, requestResponse] = await Promise.all([
      supabase.from('landlords').select('*').eq('id', currentUser.id).maybeSingle(),
      supabase.from('properties').select('id, title, landmark, verification_status, is_verified').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
      fetch('/api/verification', { headers: { Authorization: `Bearer ${sessionData.session.access_token}` } })
    ]);

    setLandlord(landlordData);
    setProperties(propertyData || []);
    const requestJson = await requestResponse.json();
    if (requestResponse.ok) setRequests(requestJson.requests || []);
    setForm((current) => ({
      ...current,
      full_name: landlordData?.full_name || currentUser.user_metadata?.full_name || '',
      phone_number: landlordData?.whatsapp_number || ''
    }));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submit = async (verificationType) => {
    setSubmitting(true);
    setMessage('');
    try {
      if (verificationType === 'property' && !propertyId) throw new Error('Select a property to verify.');
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch('/api/verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`
        },
        body: JSON.stringify({
          verification_type: verificationType,
          property_id: verificationType === 'property' ? propertyId : null,
          ...form
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to submit verification request.');
      setMessage('Verification request submitted successfully. We will review it before awarding the verified badge.');
      setPropertyId('');
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#09090B] text-gray-400 p-12 text-center">Loading verification centre...</div>;

  const landlordStatus = landlord?.verification_status || 'unverified';
  const hasPendingLandlord = requests.some((r) => r.verification_type === 'landlord' && r.status === 'pending');

  return (
    <div className="min-h-screen bg-[#09090B] text-white px-4 py-8 md:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3"><ShieldCheck className="text-blue-400" /><h1 className="text-3xl font-bold">Verification Centre</h1></div>
            <p className="text-gray-400 mt-2">Build trust with students by verifying who you are and the properties you advertise.</p>
          </div>
          <Link href="/landlord/dashboard" className="text-sm text-blue-400 hover:underline">← Back to dashboard</Link>
        </div>

        {message && <div className="bg-blue-500/10 border border-blue-500/20 text-blue-200 rounded-xl p-4">{message}</div>}

        <section className="bg-[#18181B] border border-white/10 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="text-xl font-bold">Landlord verification</h2><p className="text-sm text-gray-400 mt-1">This verifies the person responsible for the listings.</p></div>
            <span className={`px-3 py-1 rounded-full text-xs border ${statusStyles[landlordStatus]}`}>{landlordStatus}</span>
          </div>
          <div className="grid md:grid-cols-2 gap-4 mt-6">
            <label className="text-sm text-gray-300">Full name<input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-2 w-full bg-[#101012] border border-white/10 rounded-xl px-4 py-3" /></label>
            <label className="text-sm text-gray-300">Phone / WhatsApp<input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} className="mt-2 w-full bg-[#101012] border border-white/10 rounded-xl px-4 py-3" /></label>
            <label className="text-sm text-gray-300">Your role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-2 w-full bg-[#101012] border border-white/10 rounded-xl px-4 py-3"><option>Property owner</option><option>Caretaker</option><option>Authorized property manager</option></select></label>
            <label className="text-sm text-gray-300">Additional information<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anything that helps us verify you or your property." className="mt-2 w-full bg-[#101012] border border-white/10 rounded-xl px-4 py-3 min-h-[48px]" /></label>
          </div>
          <button disabled={submitting || hasPendingLandlord || landlordStatus === 'verified'} onClick={() => submit('landlord')} className="mt-5 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-semibold">{landlordStatus === 'verified' ? 'Landlord Verified ✓' : hasPendingLandlord ? 'Verification Under Review' : 'Submit for Verification'}</button>
        </section>

        <section className="bg-[#18181B] border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-bold">Property verification</h2>
          <p className="text-sm text-gray-400 mt-1">A verified landlord and a verified property are separate trust signals.</p>
          {properties.length === 0 ? <p className="mt-5 text-sm text-gray-400">You have no properties yet. <Link href="/add-property" className="text-blue-400 hover:underline">Add a listing</Link> first.</p> : (
            <div className="mt-5 grid md:grid-cols-[1fr_auto] gap-4">
              <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="bg-[#101012] border border-white/10 rounded-xl px-4 py-3">
                <option value="">Select a property</option>
                {properties.map((property) => <option key={property.id} value={property.id}>{property.title} — {property.landmark}</option>)}
              </select>
              <button disabled={submitting || !propertyId || properties.find((p) => p.id === propertyId)?.verification_status === 'verified'} onClick={() => submit('property')} className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 font-semibold">Request Property Verification</button>
            </div>
          )}
        </section>

        <section className="bg-[#18181B] border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-bold">Verification history</h2>
          <div className="mt-4 space-y-3">
            {requests.length === 0 ? <p className="text-sm text-gray-400">No verification requests yet.</p> : requests.map((request) => (
              <div key={request.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#101012] border border-white/5 rounded-xl p-4">
                <div><p className="font-semibold">{request.verification_type === 'landlord' ? 'Landlord verification' : 'Property verification'}</p><p className="text-xs text-gray-500 mt-1">Submitted {new Date(request.submitted_at).toLocaleDateString()}</p>{request.rejection_reason && <p className="text-xs text-red-300 mt-1">{request.rejection_reason}</p>}</div>
                <span className={`px-3 py-1 rounded-full text-xs border ${statusStyles[request.status]}`}>{request.status}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="flex gap-3 text-xs text-gray-500 items-center"><AlertTriangle size={14} /> Verification means Chuka Rentals reviewed the submitted information; students should still inspect a property before paying.</div>
      </div>
    </div>
  );
}
