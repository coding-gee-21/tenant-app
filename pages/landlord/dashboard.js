import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { LayoutDashboard, PlusCircle, Eye, MessageSquare, Building2, Trash2, Edit3, Bell, CheckSquare, Square, CalendarDays, ClipboardList, BadgeDollarSign, Users } from 'lucide-react';
import EditPropertyModal from '../../components/EditPropertyModal';

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [stats, setStats] = useState({ views: 0, leads: 0, total: 0 });
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState('');
  
  // Edit Modal State
  const [editingProperty, setEditingProperty] = useState(null);
  const listingQuality = (property) => {
    const checks = [property.title, property.landmark, property.walk_mins, property.semester_rent || property.price || property.rent, property.description, property.whatsapp, Array.isArray(property.images) ? property.images.length >= 3 : Boolean(property.images), property.water_type, property.security_system];
    return Math.round(checks.filter(Boolean).length / checks.length * 100);
  };

  const checkUserAndFetch = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
        return;
      }

      const { data: phoneData } = await supabase
        .from('profiles')
        .select('phone_number, phone_verified, role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (phoneData?.role !== 'landlord' && phoneData?.role !== 'admin') {
        router.replace('/landlord');
        return;
      }

      setPhoneVerified(Boolean(phoneData?.phone_verified));
      setVerifiedPhone(phoneData?.phone_number || '');

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
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(checkUserAndFetch, 0);
    return () => window.clearTimeout(timer);
  }, [checkUserAndFetch]);

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

  const openEditModal = (property) => setEditingProperty(property);

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
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/landlord/inventory" className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 font-semibold rounded-xl transition flex items-center gap-2 text-sm"><ClipboardList size={17} /> Inventory</Link>
          <Link href="/landlord/rent-notices" className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 font-semibold rounded-xl transition flex items-center gap-2 text-sm"><BadgeDollarSign size={17} /> Rent Notices</Link>
          <Link href="/landlord/viewings" className="px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20 font-semibold rounded-xl transition flex items-center gap-2 text-sm"><CalendarDays size={17} /> Viewings</Link>
          <Link
            href="/landlord/tenant-requests"
            className="px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 font-semibold rounded-xl transition flex items-center gap-2 text-sm"
          >
            <Users size={17} />
            Tenant Requests
          </Link>
          <Link
            href="/landlord/rent-concerns"
            className="px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 font-semibold rounded-xl transition flex items-center gap-2 text-sm"
          >
            <MessageSquare size={17} />
            Student Concerns
          </Link>
          <Link
            href="/landlord/review-messages"
            className="px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 font-semibold rounded-xl transition flex items-center gap-2 text-sm"
          >
            <MessageSquare size={17} />
            Review Discussions
          </Link>
          <Link
            href="/verification"
            className="px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 font-semibold rounded-xl transition flex items-center gap-2 text-sm"
          >
            <CheckSquare size={17} /> Verification
          </Link>
          <Link 
            href="/add-property" 
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition flex items-center gap-2 text-sm shadow-lg shadow-blue-600/20"
          >
            <PlusCircle size={18} /> Add New Listing
          </Link>
        </div>
      </div>

      {!phoneVerified && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-amber-200">Verify your phone number</p>
            <p className="text-sm text-amber-100/70 mt-1">
              Phone verification is required before you can publish or manage property listings.
            </p>
          </div>
          <Link
            href="/phone-verification?returnTo=/landlord/dashboard"
            className="shrink-0 px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 font-semibold text-sm"
          >
            Verify Phone
          </Link>
        </div>
      )}

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
            <p className="text-gray-400">You have not listed any properties yet.</p>
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
                    <th className="p-4">Semester Rent (Ksh)</th>
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
                          <span className={`mt-1 inline-block text-[11px] ${listingQuality(prop) >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>Listing quality: {listingQuality(prop)}%</span>
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

      {editingProperty && (
        <EditPropertyModal
          property={editingProperty}
          verifiedPhone={verifiedPhone}
          onClose={() => setEditingProperty(null)}
          onSaved={(updatedProperty) => {
            setProperties((currentProperties) =>
              currentProperties.map((property) =>
                property.id === updatedProperty.id ? updatedProperty : property
              )
            );
            setEditingProperty(null);
            alert('Property updated successfully!');
          }}
        />
      )}
    </div>
  );
}
