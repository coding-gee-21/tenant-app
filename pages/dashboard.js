import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { LayoutDashboard, PlusCircle, Eye, MessageSquare, Building2, Trash2, Edit3, Bell, CheckSquare, Square, X } from 'lucide-react';

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [stats, setStats] = useState({ views: 0, leads: 0, total: 0 });
  
  // Edit Modal State
  const [editingProperty, setEditingProperty] = useState(null);

  useEffect(() => {
    checkUserAndFetch();
  }, []);

  const checkUserAndFetch = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
        return;
      }

      // Fetch Properties
      const { data: propData, error: propError } = await supabase
        .from('properties')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (propError) throw propError;
      const myProperties = propData || [];
      setProperties(myProperties);

      // Fetch Notifications
      const { data: notifData } = await supabase
        .from('notifications')
        .select('*')
        .eq('landlord_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      setNotifications(notifData || []);

      const totalViews = myProperties.reduce((acc, curr) => acc + (curr.views_count || 0), 0);
      const totalLeads = myProperties.reduce((acc, curr) => acc + (curr.leads || 0), 0);

      setStats({
        views: totalViews,
        leads: totalLeads,
        total: myProperties.length,
      });
    } catch (err) {
      console.error('Error fetching dashboard data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this listing?')) return;
    try {
      const { error } = await supabase.from('properties').delete().eq('id', id);
      if (error) throw error;
      setProperties(properties.filter(p => p.id !== id));
      setSelectedIds(selectedIds.filter(itemId => itemId !== id));
      setStats(prev => ({ ...prev, total: prev.total - 1 }));
    } catch (err) {
      alert('Failed to delete property: ' + err.message);
    }
  };

  // Bulk Selection Handlers
  const toggleSelectAll = () => {
    if (selectedIds.length === properties.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(properties.map(p => p.id));
    }
  };

  const toggleSelectOne = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(item => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Bulk Actions
  const handleBatchStatusUpdate = async (newVacantRooms, newStatus) => {
    if (selectedIds.length === 0) {
      alert('Please select at least one property.');
      return;
    }

    try {
      const { error } = await supabase
        .from('properties')
        .update({ vacant_rooms: newVacantRooms, status: newStatus })
        .in('id', selectedIds);

      if (error) throw error;

      setProperties(properties.map(p => 
        selectedIds.includes(p.id) ? { ...p, vacant_rooms: newVacantRooms, status: newStatus } : p
      ));
      setSelectedIds([]);
      alert('Selected properties updated successfully.');
    } catch (err) {
      alert('Bulk update failed: ' + err.message);
    }
  };

  const handleToggleStatus = async (id, currentVacantRooms) => {
    const newVacantRooms = currentVacantRooms > 0 ? 0 : 1;
    const newStatus = newVacantRooms > 0 ? 'available' : 'occupied';

    try {
      const { error } = await supabase
        .from('properties')
        .update({ vacant_rooms: newVacantRooms, status: newStatus })
        .eq('id', id);

      if (error) throw error;

      setProperties(properties.map(p => 
        p.id === id ? { ...p, vacant_rooms: newVacantRooms, status: newStatus } : p
      ));
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const openEditModal = (prop) => {
    setEditingProperty({
      ...prop,
      title: prop.title || '',
      house_type: prop.house_type || 'Bedsitter',
      landmark: prop.landmark || '',
      walk_mins: prop.walk_mins || 5,
      vacant_rooms: prop.vacant_rooms || 0,
      semester_rent: prop.semester_rent || prop.price || prop.rent || 0,
      whatsapp: prop.whatsapp || '',
      electricity_type: prop.electricity_type || 'Prepaid Tokens',
      water_type: prop.water_type || 'Tokens / Metered',
      water_cost: prop.water_cost || '',
      security_system: prop.security_system || 'Security Guard',
      wifi_available: prop.wifi_available || false,
      description: prop.description || ''
    });
  };

  const handleUpdateProperty = async (e) => {
    e.preventDefault();
    if (!editingProperty) return;

    try {
      const { error } = await supabase
        .from('properties')
        .update({
          title: editingProperty.title,
          house_type: editingProperty.house_type,
          landmark: editingProperty.landmark,
          walk_mins: editingProperty.walk_mins,
          vacant_rooms: editingProperty.vacant_rooms,
          semester_rent: editingProperty.semester_rent,
          whatsapp: editingProperty.whatsapp,
          electricity_type: editingProperty.electricity_type,
          water_type: editingProperty.water_type,
          water_cost: editingProperty.water_cost,
          security_system: editingProperty.security_system,
          wifi_available: editingProperty.wifi_available,
          description: editingProperty.description,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingProperty.id);

      if (error) throw error;

      setProperties(properties.map(p => p.id === editingProperty.id ? { ...p, ...editingProperty } : p));
      setEditingProperty(null);
      alert('Property updated successfully!');
    } catch (err) {
      alert('Failed to update property: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-gray-400">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <LayoutDashboard className="text-blue-400" /> Dashboard
          </h1>
          <p className="text-gray-400 text-sm mt-1">Manage your rental properties and leads.</p>
        </div>
        <Link 
          href="/add-property" 
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition flex items-center gap-2 text-sm shadow-lg shadow-blue-600/20"
        >
          <PlusCircle size={18} /> Add New Listing
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-[#18181B] border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-sm font-medium">Listed Properties</span>
            <Building2 size={20} className="text-blue-400" />
          </div>
          <p className="text-3xl font-extrabold text-white">{stats?.total ?? 0}</p>
        </div>

        <div className="p-6 rounded-2xl bg-[#18181B] border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-sm font-medium">Total Views</span>
            <Eye size={20} className="text-emerald-400" />
          </div>
          <p className="text-3xl font-extrabold text-emerald-400">{stats?.views ?? 0}</p>
        </div>

        <div className="p-6 rounded-2xl bg-[#18181B] border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-sm font-medium">WhatsApp Leads</span>
            <MessageSquare size={20} className="text-purple-400" />
          </div>
          <p className="text-3xl font-extrabold text-purple-400">{stats?.leads ?? 0}</p>
        </div>
      </div>

      {/* Notification Feed Section */}
      <div className="bg-[#18181B] border border-white/10 rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Bell size={18} className="text-amber-400" /> Notification & Activity Feed
        </h2>
        {notifications.length === 0 ? (
          <p className="text-sm text-gray-400">No recent notifications.</p>
        ) : (
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {notifications.map((notif) => (
              <div key={notif.id} className="bg-[#242427]/50 border border-white/5 p-3.5 rounded-xl flex justify-between items-center text-sm">
                <div>
                  <span className="font-semibold text-white">{notif.title}: </span>
                  <span className="text-gray-300">{notif.message}</span>
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">{new Date(notif.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Properties Table with Bulk Actions */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h2 className="text-xl font-bold">Your Listed Properties</h2>
          
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 bg-[#242427] px-4 py-2 rounded-xl border border-white/10">
              <span className="text-xs text-gray-300 font-medium">{selectedIds.length} selected:</span>
              <button
                onClick={() => handleBatchStatusUpdate(1, 'available')}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition"
              >
                Mark Vacant
              </button>
              <button
                onClick={() => handleBatchStatusUpdate(0, 'occupied')}
                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition"
              >
                Mark Occupied
              </button>
            </div>
          )}
        </div>
        
        {properties.length === 0 ? (
          <div className="p-12 text-center bg-[#18181B] rounded-2xl border border-white/10 space-y-4">
            <p className="text-gray-400">You haven't listed any properties yet.</p>
            <Link 
              href="/add-property" 
              className="inline-block px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl text-sm transition"
            >
              List Your First Property
            </Link>
          </div>
        ) : (
          <div className="bg-[#18181B] border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-[#242427] text-gray-400 uppercase text-xs">
                  <tr>
                    <th className="p-4 w-10">
                      <button onClick={toggleSelectAll} className="text-gray-400 hover:text-white">
                        {selectedIds.length === properties.length ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>
                    </th>
                    <th className="p-4">Property</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Rent (Ksh)</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {properties.map((prop) => {
                    const isSelected = selectedIds.includes(prop.id);
                    return (
                      <tr key={prop.id} className="hover:bg-[#242427]/50 transition">
                        <td className="p-4">
                          <button onClick={() => toggleSelectOne(prop.id)} className="text-gray-400 hover:text-white">
                            {isSelected ? <CheckSquare size={16} className="text-blue-400" /> : <Square size={16} />}
                          </button>
                        </td>
                        <td className="p-4 font-semibold text-white">
                          {prop.title}
                          <span className="block text-xs font-normal text-gray-400">{prop.landmark || 'Ndagani'}</span>
                        </td>
                        <td className="p-4 text-gray-400">{prop.house_type || 'Bedsitter'}</td>
                        <td className="p-4 text-emerald-400 font-bold">{Number(prop.semester_rent || prop.price || prop.rent || 0).toLocaleString()}</td>
                        
                        <td className="p-4">
                          <button
                            onClick={() => handleToggleStatus(prop.id, prop.vacant_rooms)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 w-fit ${
                              prop.vacant_rooms > 0 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20' 
                                : 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${prop.vacant_rooms > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                            {prop.vacant_rooms > 0 ? `${prop.vacant_rooms} Vacant` : 'Occupied'}
                          </button>
                        </td>

                        <td className="p-4 text-right space-x-2 whitespace-nowrap">
                          <button 
                            onClick={() => openEditModal(prop)}
                            className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium transition inline-flex items-center gap-1"
                          >
                            <Edit3 size={14} /> Edit
                          </button>
                          <button 
                            onClick={() => handleDelete(prop.id)}
                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition inline-block"
                            title="Delete Listing"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Edit Property Modal */}
      {editingProperty && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-[#121215] border border-white/10 rounded-2xl max-w-2xl w-full p-6 text-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
              <h3 className="text-xl font-bold text-[#E8DCC4]">Edit Property Listing</h3>
              <button onClick={() => setEditingProperty(null)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateProperty} className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Property Title *</label>
                  <input
                    type="text"
                    value={editingProperty.title || ''}
                    onChange={(e) => setEditingProperty({...editingProperty, title: e.target.value})}
                    className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#E8DCC4]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">House Type *</label>
                  <select
                    value={editingProperty.house_type || 'Bedsitter'}
                    onChange={(e) => setEditingProperty({...editingProperty, house_type: e.target.value})}
                    className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#E8DCC4]"
                  >
                    <option value="Bedsitter">Bedsitter</option>
                    <option value="Single Room">Single Room</option>
                    <option value="1 Bedroom">1 Bedroom</option>
                    <option value="Hostel">Hostel</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Landmark *</label>
                  <input
                    type="text"
                    value={editingProperty.landmark || ''}
                    onChange={(e) => setEditingProperty({...editingProperty, landmark: e.target.value})}
                    className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#E8DCC4]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Walk (Mins) *</label>
                  <input
                    type="number"
                    value={editingProperty.walk_mins || ''}
                    onChange={(e) => setEditingProperty({...editingProperty, walk_mins: e.target.value})}
                    className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#E8DCC4]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Vacant Rooms *</label>
                  <input
                    type="number"
                    value={editingProperty.vacant_rooms || ''}
                    onChange={(e) => setEditingProperty({...editingProperty, vacant_rooms: e.target.value})}
                    className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#E8DCC4]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Semester Rent (Ksh) *</label>
                  <input
                    type="number"
                    value={editingProperty.semester_rent || ''}
                    onChange={(e) => setEditingProperty({...editingProperty, semester_rent: e.target.value})}
                    className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#E8DCC4]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">WhatsApp Contact *</label>
                  <input
                    type="text"
                    value={editingProperty.whatsapp || ''}
                    onChange={(e) => setEditingProperty({...editingProperty, whatsapp: e.target.value})}
                    className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#E8DCC4]"
                    required
                  />
                </div>
              </div>

              {/* Amenities & Specifications Section */}
              <div className="bg-[#1A1A1A] border border-white/10 rounded-xl p-4 space-y-4 mt-4">
                <h4 className="text-sm font-semibold text-[#E8DCC4] uppercase tracking-wider">Property Amenities & Specifications</h4>
                
                {/* Electricity */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
                  <span className="text-sm font-medium">Electricity Type</span>
                  <select
                    value={editingProperty.electricity_type || 'Prepaid Tokens'}
                    onChange={(e) => setEditingProperty({...editingProperty, electricity_type: e.target.value})}
                    className="bg-[#121215] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white"
                  >
                    <option value="Prepaid Tokens">Prepaid Tokens</option>
                    <option value="Postpaid / Metered">Postpaid / Metered</option>
                    <option value="Included in Rent">Included in Rent</option>
                  </select>
                </div>

                {/* Water Supply */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
                  <span className="text-sm font-medium">Water Supply & Cost</span>
                  <div className="flex gap-2">
                    <select
                      value={editingProperty.water_type || 'Tokens / Metered'}
                      onChange={(e) => setEditingProperty({...editingProperty, water_type: e.target.value})}
                      className="bg-[#121215] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white"
                    >
                      <option value="Tokens / Metered">Tokens / Metered</option>
                      <option value="Running Water Available">Running Water Available</option>
                      <option value="Free / Included">Free / Included</option>
                    </select>
                    <input
                      type="text"
                      placeholder="e.g. Ksh 1000"
                      value={editingProperty.water_cost || ''}
                      onChange={(e) => setEditingProperty({...editingProperty, water_cost: e.target.value})}
                      className="bg-[#121215] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white w-28"
                    />
                  </div>
                </div>

                {/* Security */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
                  <span className="text-sm font-medium">Security System</span>
                  <select
                    value={editingProperty.security_system || 'Security Guard'}
                    onChange={(e) => setEditingProperty({...editingProperty, security_system: e.target.value})}
                    className="bg-[#121215] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white"
                  >
                    <option value="Security Guard">Security Guard</option>
                    <option value="Gated Compound">Gated Compound</option>
                    <option value="CCTV Surveillance">CCTV Surveillance</option>
                    <option value="None">None</option>
                  </select>
                </div>

                {/* Wi-Fi */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">High-Speed Wi-Fi Available</span>
                  <input
                    type="checkbox"
                    checked={editingProperty.wifi_available || false}
                    onChange={(e) => setEditingProperty({...editingProperty, wifi_available: e.target.checked})}
                    className="w-5 h-5 accent-[#E8DCC4] rounded"
                  />
                </div>
              </div>

              {/* Description / Notes */}
              <div>
                <label className="block text-sm font-medium mb-1">Description / Notes</label>
                <textarea
                  rows={3}
                  value={editingProperty.description || ''}
                  onChange={(e) => setEditingProperty({...editingProperty, description: e.target.value})}
                  className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#E8DCC4]"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingProperty(null)}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#E8DCC4] text-black font-semibold hover:bg-white transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}