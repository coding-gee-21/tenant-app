import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookmarkPlus, GitCompareArrows, Search, SlidersHorizontal } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import PropertyCard from '../components/PropertyCard';
import { useToast } from '../components/Toast';

export default function Rentals() {
  const [properties, setProperties] = useState(null);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [budget, setBudget] = useState('');
  const [walk, setWalk] = useState('');
  const [available, setAvailable] = useState(true);
  const [sort, setSort] = useState('match');
  const [compareIds, setCompareIds] = useState([]);
  const { showToast } = useToast();

  useEffect(() => {
    const load = async () => {
      const stored = JSON.parse(localStorage.getItem('chuka-compare') || '[]');
      setCompareIds(Array.isArray(stored) ? stored : []);
      const { data, error } = await supabase.from('properties').select('*').eq('listing_status', 'approved').order('created_at', { ascending: false });
      if (error) { showToast(error.message, 'error'); setProperties([]); return; }
      const ids = (data || []).map((item) => item.id);
      const { data: reviews } = ids.length ? await supabase.from('reviews').select('property_id,rating,water_rating,security_rating,would_recommend').in('property_id', ids).eq('status', 'approved') : { data: [] };
      setProperties((data || []).map((property) => { const group = (reviews || []).filter((review) => review.property_id === property.id); const avg = (field) => { const values = group.map((review) => Number(review[field])).filter(Boolean); return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; }; return { ...property, average_rating: avg('rating'), average_water_rating: avg('water_rating'), average_security_rating: avg('security_rating'), recommendation_percentage: group.length ? Math.round(group.filter((review) => review.would_recommend).length / group.length * 100) : 0, review_count: group.length }; }));
    };
    Promise.resolve().then(load);
  }, [showToast]);

  const results = useMemo(() => (properties || []).filter((property) => {
    const text = `${property.title || ''} ${property.landmark || ''}`.toLowerCase();
    const price = Number(property.semester_rent || property.price || property.rent || 0);
    return (!query || text.includes(query.toLowerCase())) && (!type || property.house_type === type) && (!budget || price <= Number(budget)) && (!walk || Number(property.walk_mins || 999) <= Number(walk)) && (!available || Number(property.vacant_rooms || 0) > 0);
  }).sort((a, b) => sort === 'price' ? Number(a.semester_rent || a.price || 0) - Number(b.semester_rent || b.price || 0) : sort === 'distance' ? Number(a.walk_mins || 999) - Number(b.walk_mins || 999) : sort === 'rating' ? Number(b.average_rating || 0) - Number(a.average_rating || 0) : 0), [properties, query, type, budget, walk, available, sort]);

  const toggleCompare = (property) => {
    let next = compareIds.includes(property.id) ? compareIds.filter((id) => id !== property.id) : [...compareIds, property.id];
    if (next.length > 3) { showToast('You can compare up to three properties.', 'error'); return; }
    setCompareIds(next); localStorage.setItem('chuka-compare', JSON.stringify(next));
  };
  const saveProperty = async (property) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = '/auth?returnTo=/rentals'; return; }
    const { error } = await supabase.from('bookmarks').upsert({ user_id: user.id, property_id: property.id }, { onConflict: 'user_id,property_id' });
    showToast(error ? error.message : 'Property saved to your shortlist.', error ? 'error' : 'success');
  };
  const saveSearch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = '/auth?returnTo=/rentals'; return; }
    const name = [type || 'All rooms', budget && `under KSh ${Number(budget).toLocaleString()}`, walk && `within ${walk} min`].filter(Boolean).join(' · ');
    const { error } = await supabase.from('saved_searches').insert({ user_id: user.id, name, filters: { query, type, budget, walk, available } });
    showToast(error ? error.message : 'Search saved. You can revisit it from your account.', error ? 'error' : 'success');
  };

  return <div className="space-y-7 pb-24 text-white"><div><p className="text-sm font-semibold text-blue-400">Student housing discovery</p><h1 className="mt-1 text-3xl font-bold">All rentals near Chuka University</h1><p className="mt-2 text-gray-400">Filter, save and compare properties before contacting a landlord.</p></div><div className="rounded-2xl border border-white/10 bg-[#18181B] p-4"><div className="grid gap-3 md:grid-cols-5"><div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#101013] px-3"><Search size={17} className="text-gray-500" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Landmark or property" className="w-full bg-transparent py-3 text-sm outline-none" /></div><select value={type} onChange={(e) => setType(e.target.value)} className="rounded-xl border border-white/10 bg-[#101013] p-3 text-sm"><option value="">All house types</option><option>Bedsitter</option><option>Single room</option><option>1 Bedroom</option><option>2 Bedroom</option></select><select value={budget} onChange={(e) => setBudget(e.target.value)} className="rounded-xl border border-white/10 bg-[#101013] p-3 text-sm"><option value="">Any budget</option><option value="20000">Under KSh 20,000</option><option value="25000">Under KSh 25,000</option><option value="30000">Under KSh 30,000</option><option value="40000">Under KSh 40,000</option></select><select value={walk} onChange={(e) => setWalk(e.target.value)} className="rounded-xl border border-white/10 bg-[#101013] p-3 text-sm"><option value="">Any walking time</option><option value="5">Within 5 min</option><option value="10">Within 10 min</option><option value="15">Within 15 min</option><option value="20">Within 20 min</option></select><button onClick={saveSearch} className="flex items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-300"><BookmarkPlus size={17} />Save search</button></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} />Available now</label><div className="flex items-center gap-2"><SlidersHorizontal size={16} className="text-gray-500" /><select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border border-white/10 bg-[#101013] px-3 py-2 text-sm"><option value="match">Best match</option><option value="price">Lowest rent</option><option value="distance">Closest</option><option value="rating">Highest rated</option></select></div></div></div><div className="flex justify-between"><p className="text-sm text-gray-400"><strong className="text-white">{results.length}</strong> matching properties</p></div>{properties === null ? <div className="grid gap-6 md:grid-cols-3">{[1,2,3].map((n)=><div key={n} className="h-80 animate-pulse rounded-2xl bg-white/5" />)}</div> : results.length ? <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{results.map((property)=><PropertyCard key={property.id} property={property} onSave={saveProperty} onToggleCompare={toggleCompare} compareSelected={compareIds.includes(property.id)} />)}</div> : <div className="rounded-2xl border border-white/10 bg-[#18181B] p-12 text-center text-gray-400">No rentals match these filters. Try increasing your budget or walking time.</div>}{compareIds.length > 0 && <div className="fixed bottom-16 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-2xl border border-blue-500/30 bg-[#10131A]/95 px-5 py-3 shadow-2xl backdrop-blur-xl md:bottom-5"><GitCompareArrows className="text-blue-400" /><span className="text-sm">{compareIds.length} selected</span><Link href="/compare" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold">Compare</Link><button onClick={() => { setCompareIds([]); localStorage.removeItem('chuka-compare'); }} className="text-xs text-gray-400">Clear</button></div>}</div>;
}
