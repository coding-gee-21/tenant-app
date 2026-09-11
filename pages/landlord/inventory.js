import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Camera, ClipboardList, Plus, Printer, ShieldCheck, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const makeReference = () => `CR-INV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const blankItem = () => ({ description: '', brandModel: '', colour: '', serialNumber: '', quantity: 1, exactCondition: '', storageLocation: '', packaging: '', photoReference: '', photoUrl: '', notes: '' });
const inputClass = 'mt-1 w-full rounded-xl border border-white/10 bg-[#101013] p-3 text-white outline-none focus:border-blue-500 print:rounded-none print:border-black print:bg-white print:p-1 print:text-black';

export default function Inventory() {
  const router = useRouter();
  const [properties, setProperties] = useState([]);
  const [form, setForm] = useState({
    recordType: 'Tenant Absentee Storage', reference: makeReference(), propertyId: '', propertyAddress: '', room: '',
    tenantName: '', tenantPhone: '', tenantEmail: '', admissionNumber: '', conductedDate: '', conductedTime: '',
    absenceFrom: '', expectedReturn: '', inspectedBy: '', agentPhone: '', accessInstructions: '',
    keysHeldBy: '', generalNotes: '', items: [blankItem()]
  });

  useEffect(() => { (async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.replace('/auth?returnTo=/landlord/inventory');
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
    if (!['landlord', 'admin'].includes(profile?.role)) return router.replace('/landlord');
    const { data } = await supabase.from('properties').select('id,title,landmark').or(`user_id.eq.${session.user.id},landlord_id.eq.${session.user.id}`).order('title');
    setProperties(data || []);
  })(); }, [router]);

  const selectedProperty = properties.find((item) => item.id === form.propertyId);
  const photographed = useMemo(() => form.items.filter((item) => item.photoUrl || item.photoReference).length, [form.items]);
  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateItem = (index, key, value) => setForm((current) => ({ ...current, items: current.items.map((item, i) => i === index ? { ...item, [key]: value } : item) }));
  const addPhoto = (index, file) => {
    if (!file) return;
    updateItem(index, 'photoUrl', URL.createObjectURL(file));
    updateItem(index, 'photoReference', file.name);
  };

  const detailFields = [
    ['Property address / location', 'propertyAddress', 'text'], ['Room / unit number', 'room', 'text'],
    ['Tenant full name', 'tenantName', 'text'], ['Tenant phone', 'tenantPhone', 'tel'], ['Tenant email', 'tenantEmail', 'email'],
    ['Admission / identification number', 'admissionNumber', 'text'], ['Inventory date', 'conductedDate', 'date'], ['Inventory time', 'conductedTime', 'time'],
    ['Absence begins', 'absenceFrom', 'date'], ['Expected return', 'expectedReturn', 'date'], ['Inventory conducted by', 'inspectedBy', 'text'],
    ['Landlord / agent phone', 'agentPhone', 'tel'], ['Keys held by', 'keysHeldBy', 'text']
  ];

  return <div className="mx-auto max-w-7xl space-y-6 text-white print:max-w-none print:text-black">
    <header className="flex flex-wrap items-center justify-between gap-4 print:hidden">
      <div><Link href="/landlord/dashboard" className="text-sm text-blue-400">← Landlord dashboard</Link><h1 className="mt-2 flex items-center gap-2 text-3xl font-bold"><ClipboardList className="text-blue-400" /> Professional Property Inventory</h1><p className="mt-2 max-w-3xl text-gray-400">Create a jointly inspected, photo-supported record for belongings left during a tenant&apos;s absence or for check-in/check-out.</p></div>
      <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500"><Printer size={18} /> Print signed copies</button>
    </header>

    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#18181B] print:overflow-visible print:rounded-none print:border-0 print:bg-white">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 bg-gradient-to-r from-blue-600/20 to-emerald-500/10 p-6 print:border-black print:bg-white">
        <div><p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-300 print:text-black">Chuka Rentals</p><h2 className="mt-1 text-2xl font-bold">Tenant Property Inventory Record</h2><p className="mt-1 text-sm text-gray-400 print:text-black">Absentee storage • Check-in • Check-out • Evidence record</p></div>
        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-right print:border-black print:bg-white"><span className="block text-xs text-gray-400 print:text-black">Inventory reference</span><strong>{form.reference}</strong></div>
      </div>

      <div className="space-y-8 p-6 print:p-0 print:pt-4">
        <section>
          <h3 className="mb-4 flex items-center gap-2 font-semibold"><ShieldCheck size={18} className="text-emerald-400 print:text-black" /> Record and custody details</h3>
          <div className="grid gap-4 md:grid-cols-4">
            <label className="text-sm">Record type<select value={form.recordType} onChange={(e) => setField('recordType', e.target.value)} className={inputClass}><option>Tenant Absentee Storage</option><option>Check-in Inventory</option><option>Check-out Inventory</option></select></label>
            <label className="text-sm">Listed property<select value={form.propertyId} onChange={(e) => { const property = properties.find((item) => item.id === e.target.value); setForm((current) => ({ ...current, propertyId: e.target.value, propertyAddress: property?.landmark || current.propertyAddress })); }} className={inputClass}><option value="">Select property</option>{properties.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
            {detailFields.map(([label, key, type]) => <label key={key} className="text-sm">{label}<input type={type} value={form[key]} onChange={(e) => setField(key, e.target.value)} className={inputClass} /></label>)}
          </div>
          {selectedProperty && <p className="mt-3 text-xs text-gray-500 print:text-black">Selected listing: {selectedProperty.title} — {selectedProperty.landmark || 'location not supplied'}</p>}
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h3 className="font-semibold">Itemized belongings and photographic evidence</h3><p className="mt-1 text-sm text-gray-400 print:text-black">Use one row per distinct item. Record existing flaws precisely; avoid descriptions such as “okay” or “normal.”</p></div><div className="flex gap-2 text-xs"><span className="rounded-full bg-white/5 px-3 py-1.5 print:border print:border-black">{form.items.length} item rows</span><span className="rounded-full bg-white/5 px-3 py-1.5 print:border print:border-black">{photographed} photo references</span></div></div>
          <div className="space-y-4">
            {form.items.map((item, index) => <article key={index} className="break-inside-avoid rounded-2xl border border-white/10 bg-[#101013] p-4 print:rounded-none print:border-black print:bg-white">
              <div className="mb-3 flex items-center justify-between"><h4 className="font-semibold">Item {index + 1}</h4><button type="button" onClick={() => form.items.length > 1 && setField('items', form.items.filter((_, i) => i !== index))} className="text-red-400 print:hidden" aria-label={`Remove item ${index + 1}`}><Trash2 size={17} /></button></div>
              <div className="grid gap-3 md:grid-cols-4">
                {[['Clear item description','description'],['Brand / model','brandModel'],['Colour / distinguishing marks','colour'],['Serial / asset number','serialNumber'],['Quantity','quantity'],['Exact condition and existing flaws','exactCondition'],['Exact storage location','storageLocation'],['Packaging / lock / seal details','packaging'],['Photo reference','photoReference'],['Additional notes','notes']].map(([label,key]) => <label key={key} className={`text-xs ${['exactCondition','storageLocation','notes'].includes(key) ? 'md:col-span-2' : ''}`}>{label}<input type={key === 'quantity' ? 'number' : 'text'} min={key === 'quantity' ? 1 : undefined} value={item[key]} onChange={(e) => updateItem(index,key,e.target.value)} placeholder={key === 'storageLocation' ? 'e.g. Bedroom 2, locked upper closet, Bin A' : key === 'exactCondition' ? 'e.g. 2 cm scratch on left side; screen intact' : ''} className={inputClass} /></label>)}
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-blue-500/40 bg-blue-500/5 p-3 text-xs text-blue-300 print:hidden"><Camera size={16} /> Attach dated photo<input type="file" accept="image/*" capture="environment" onChange={(e) => addPhoto(index, e.target.files?.[0])} className="hidden" /></label>
                {item.photoUrl && <div><img src={item.photoUrl} alt={`Evidence for item ${index + 1}`} className="h-24 w-full rounded-lg border border-white/10 object-cover print:h-20 print:border-black" /></div>}
              </div>
            </article>)}
          </div>
          <button type="button" onClick={() => setField('items', [...form.items, blankItem()])} className="mt-4 flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-300 print:hidden"><Plus size={16} /> Add another belonging</button>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <label className="text-sm">Access and emergency instructions<textarea rows="4" value={form.accessInstructions} onChange={(e) => setField('accessInstructions', e.target.value)} placeholder="State who may access the belongings, how permission is obtained, and the emergency contact procedure." className={inputClass} /></label>
          <label className="text-sm">General observations<textarea rows="4" value={form.generalNotes} onChange={(e) => setField('generalNotes', e.target.value)} placeholder="Record room condition, number of sealed boxes, photographs taken, or any disagreement noted during inspection." className={inputClass} /></label>
        </section>

        <section className="break-inside-avoid rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 print:rounded-none print:border-black print:bg-white">
          <h3 className="font-semibold">Joint declaration</h3>
          <p className="mt-2 text-sm leading-6 text-gray-300 print:text-black">The tenant and landlord or authorised agent confirm that they jointly reviewed this record and that, to the best of their knowledge, it accurately identifies the listed belongings, visible condition, packaging and designated storage location on the inventory date. Any correction must be written, dated and initialled by both parties. Each party should retain a signed copy together with the referenced photographs.</p>
          <div className="mt-12 grid gap-12 md:grid-cols-3"><div className="border-t border-white/40 pt-2 text-xs print:border-black">Tenant: name, signature and date</div><div className="border-t border-white/40 pt-2 text-xs print:border-black">Landlord / authorised agent: name, signature and date</div><div className="border-t border-white/40 pt-2 text-xs print:border-black">Independent witness (optional): name, signature and date</div></div>
        </section>
        <footer className="flex justify-between border-t border-white/10 pt-3 text-[10px] text-gray-500 print:border-black print:text-black"><span>{form.reference}</span><span>Confidential tenancy record — retain securely</span></footer>
      </div>
    </section>
    <style jsx global>{`@media print { nav, footer:not(section footer), .print\\:hidden { display:none !important; } body { background:white !important; } input, textarea, select { color:black !important; } @page { size:A4 portrait; margin:12mm; } }`}</style>
  </div>;
}
