import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import PropertyCard from '../../components/PropertyCard';
import { useToast } from '../../components/Toast';

export default function SavedRentals() {
  const [items, setItems] = useState(null); const { showToast } = useToast();
  const load = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) { window.location.href = '/auth?returnTo=/account/saved'; return; } const { data, error } = await supabase.from('bookmarks').select('property_id, properties(*)').eq('user_id', user.id); if (error) showToast(error.message, 'error'); setItems((data || []).map((row) => row.properties).filter(Boolean)); };
  useEffect(() => { Promise.resolve().then(load); }, []);
  const remove = async (property) => { const { data: { user } } = await supabase.auth.getUser(); await supabase.from('bookmarks').delete().eq('user_id', user.id).eq('property_id', property.id); showToast('Property removed from saved rentals.', 'info'); load(); };
  return <div className="space-y-7 text-white"><div><p className="flex items-center gap-2 text-sm text-blue-400"><Heart size={17} />Student shortlist</p><h1 className="mt-1 text-3xl font-bold">Saved rentals</h1><p className="mt-2 text-gray-400">Keep your strongest options together before comparing or booking a viewing.</p></div>{items === null ? <p className="text-gray-400">Loading saved rentals…</p> : items.length ? <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{items.map((property)=><PropertyCard key={property.id} property={property} onSave={remove} />)}</div> : <div className="rounded-2xl border border-white/10 bg-[#18181B] p-10 text-center"><p className="text-gray-300">You have not saved any rentals yet.</p><Link href="/rentals" className="mt-4 inline-block rounded-xl bg-blue-600 px-5 py-3">Find rentals</Link></div>}</div>;
}
