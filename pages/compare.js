import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, GitCompareArrows, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function CompareProperties() {
  const [properties, setProperties] = useState(null);
  useEffect(() => { const load = async () => { const ids = JSON.parse(localStorage.getItem('chuka-compare') || '[]'); if (!ids.length) { setProperties([]); return; } const { data } = await supabase.from('properties').select('*').in('id', ids); setProperties(data || []); }; load(); }, []);
  const price = (property) => Number(property.semester_rent || property.price || property.rent || 0).toLocaleString();
  const rows = [
    ['Semester rent', (p) => `KSh ${price(p)}`], ['Walking time', (p) => p.walk_mins ? `${p.walk_mins} minutes` : 'Not supplied'], ['Vacant rooms', (p) => p.vacant_rooms ?? 'Not supplied'], ['House type', (p) => p.house_type || 'Not supplied'], ['Water', (p) => p.water_type || 'Not supplied'], ['Electricity', (p) => p.electricity_type || 'Not supplied'], ['Security', (p) => p.security_system || 'Not supplied'], ['Wi-Fi', (p) => p.wifi_available ? <Check className="mx-auto text-emerald-400" /> : <X className="mx-auto text-gray-600" />], ['Verified', (p) => p.is_verified || p.verification_status === 'verified' ? <Check className="mx-auto text-emerald-400" /> : 'Pending']
  ];
  return <div className="space-y-7 text-white"><div><p className="flex items-center gap-2 text-sm text-blue-400"><GitCompareArrows size={17} />Property comparison</p><h1 className="mt-1 text-3xl font-bold">Compare your shortlist</h1></div>{properties === null ? <p className="text-gray-400">Loading comparison…</p> : properties.length < 2 ? <div className="rounded-2xl border border-white/10 bg-[#18181B] p-10 text-center"><p className="text-gray-300">Select at least two properties from the rentals page.</p><Link href="/rentals" className="mt-4 inline-block rounded-xl bg-blue-600 px-5 py-3">Browse rentals</Link></div> : <div className="overflow-x-auto rounded-2xl border border-white/10"><table className="w-full min-w-[700px] bg-[#18181B] text-sm"><thead><tr><th className="p-4 text-left text-gray-500">Feature</th>{properties.map((p)=><th key={p.id} className="p-4 text-left"><Link href={`/properties/${p.id}`} className="text-blue-300 hover:underline">{p.title}</Link><span className="mt-1 block text-xs font-normal text-gray-500">{p.landmark}</span></th>)}</tr></thead><tbody>{rows.map(([label, render])=><tr key={label} className="border-t border-white/10"><th className="p-4 text-left font-medium text-gray-400">{label}</th>{properties.map((p)=><td key={p.id} className="p-4 text-center text-gray-200">{render(p)}</td>)}</tr>)}</tbody></table></div>}</div>;
}
