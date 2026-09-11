import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '../../lib/supabaseClient';
import { useUser } from '../../lib/useUser';
import ImageCarousel from '../../components/ImageCarousel';
import { handleWhatsAppClick } from '../../utils/trackLead';
import { Eye, Bookmark, Flag, CheckCircle, CalendarDays, UserRound, ShieldCheck, BellRing, TrendingUp, House, MapPin } from 'lucide-react';
import ReviewSection from '../../components/ReviewSection';
import ViewingRequestModal from '../../components/ViewingRequestModal';
import { useToast } from '../../components/Toast';

const PropertyMapViewer = dynamic(
  () => import('../../components/PropertyMapViewer'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-80 items-center justify-center rounded-xl border border-white/10 bg-[#121215] text-sm text-gray-400">
        Loading hostel location...
      </div>
    ),
  }
);

export default function PropertyDetail() {
  const router = useRouter();
  const { id } = router.query;
  const user = useUser();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rentNotices, setRentNotices] = useState([]);
  const [tenancyStatus, setTenancyStatus] = useState(null);
  const [showTenancyModal, setShowTenancyModal] = useState(false);
  const [tenancyRoom, setTenancyRoom] = useState('');
  const [tenancyMessage, setTenancyMessage] = useState('');
  const [tenancyLoading, setTenancyLoading] = useState(false);
  
  // Bookmarks & Views
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showViewingRequest, setShowViewingRequest] = useState(false);
  const { showToast } = useToast();

  // Reporting Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState('Fraudulent Listing');
  const [reportReason, setReportReason] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  useEffect(() => {
    if (!id || id === '[id]') return;
    async function loadPropertyAndRecordView() {
      // 1. Fetch Property Details
      const { data, error } = await supabase
        .from('properties')
        .select('*, landlord:landlords(*)')
        .eq('id', id)
        .eq('listing_status', 'approved')
        .single();
      
      if (!error && data) {
        setProperty(data);

        const {
          data: noticeData,
          error: noticeError
        } = await supabase
          .from('rent_change_notices')
          .select(`
            id,
            previous_semester_rent,
            proposed_semester_rent,
            effective_semester,
            reason,
            notice_date,
            published_at,
            supporting_document_url,
            status
          `)
          .eq('property_id', id)
          .eq('status', 'published')
          .order('published_at', {
            ascending: false
          });

        if (noticeError) {
          console.error(
            'Failed to load rent notices:',
            noticeError
          );
        } else {
          setRentNotices(noticeData || []);
        }

        // 2. Increment Real-Time View Counter in Supabase
        const { error: viewError } = await supabase.rpc('increment_property_views', { p_property_id: id });
        if (viewError) console.error('Failed to increment views:', viewError);
      }
      setLoading(false);
    }

    async function checkBookmarkStatus() {
      if (!user) return;
      const { data } = await supabase
        .from('bookmarks')
        .select('*')
        .eq('user_id', user.id)
        .eq('property_id', id)
        .maybeSingle();
      if (data) setIsBookmarked(true);
    }

    loadPropertyAndRecordView();
    checkBookmarkStatus();
  }, [id, user]);

  useEffect(() => {
    if (!id || !user) return;

    async function checkTenancyConnection() {
      const { data, error } = await supabase
        .from('property_tenants')
        .select('status, room_number, landlord_note')
        .eq('property_id', id)
        .eq('student_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Unable to check tenancy connection:', error);
        return;
      }

      setTenancyStatus(data?.status || null);

      if (data?.room_number) {
        setTenancyRoom(data.room_number);
      }
    }

    checkTenancyConnection();
  }, [id, user]);

  const handleBookmarkToggle = async () => {
    if (!user) {
      showToast('Log in to save properties.', 'info');
      router.push('/auth');
      return;
    }

    if (isBookmarked) {
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('user_id', user.id)
        .eq('property_id', id);
      if (!error) { setIsBookmarked(false); showToast('Property removed from saved rentals.', 'info'); }
    } else {
      const { error } = await supabase
        .from('bookmarks')
        .insert({ user_id: user.id, property_id: id });
      if (!error) { setIsBookmarked(true); showToast('Property saved to your shortlist.'); }
    }
  };

  const handleWhatsApp = async () => {
    if (!property) return;

    const phone = property.whatsapp || property.landlord?.whatsapp_number;

    if (!phone) {
      showToast('The landlord has not provided a WhatsApp number.', 'error');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('0') ? `254${cleanPhone.substring(1)}` : cleanPhone;

    const msg = `Hello, I saw your property listing "${property.title}" on Chuka Rentals. Is it still available?`;

    handleWhatsAppClick(property.id, formattedPhone);

    window.open(
      `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`,
      '_blank'
    );

    try {
      if (property.user_id || property.landlord_id) {
        await supabase.from('notifications').insert({
          landlord_id: property.user_id || property.landlord_id,
          title: 'New WhatsApp enquiry',
          message: `A student contacted you about "${property.title}".`,
          type: 'whatsapp_lead'
        });
      }

      await supabase.from('property_inquiries').insert({
        property_id: property.id,
        inquiry_type: 'whatsapp'
      });
    } catch (err) {
      console.error('Failed to track WhatsApp enquiry:', err);
    }
  };

  const handleCall = async () => {
    if (!property) return;

    const phone = property.whatsapp || property.landlord?.whatsapp_number || property.landlord?.phone_number;

    if (!phone) {
      showToast('The landlord has not provided a phone number.', 'error');
      return;
    }

    window.location.href = `tel:${phone}`;

    try {
      await supabase.from('property_inquiries').insert({
        property_id: property.id,
        inquiry_type: 'call'
      });
    } catch (err) {
      console.error('Failed to track call enquiry:', err);
    }
  };

  const handleReport = async (e) => {
    e.preventDefault();

    if (!reportReason.trim()) {
      alert('Please describe the issue.');
      return;
    }

    setReportLoading(true);

    try {
      const {
        data: { user: currentUser }
      } = await supabase.auth.getUser();

      const { error: reportError } = await supabase
        .from('property_reports')
        .insert({
          property_id: property.id,
          reporter_id: currentUser ? currentUser.id : null,
          issue_type: reportType,
          description: reportReason.trim(),
          admin_status: 'pending'
        });

      if (reportError) throw reportError;

      const combinedReason = `${reportType}: ${reportReason.trim()}`;

      const { error: flagError } = await supabase
        .from('properties')
        .update({
          is_flagged: true,
          flag_reason: combinedReason,
          flagged_at: new Date().toISOString()
        })
        .eq('id', property.id);

      if (flagError) throw flagError;

      if (property.user_id) {
        await supabase.from('notifications').insert({
          landlord_id: property.user_id,
          title: 'Listing Flagged / Reported',
          message: `Your property "${property.title}" has been reported for: ${reportType}. It is now under administrator review.`,
          type: 'property_report'
        });
      }

      setProperty((current) => ({
        ...current,
        is_flagged: true,
        flag_reason: combinedReason,
        flagged_at: new Date().toISOString()
      }));

      setReportSuccess(true);
      setReportReason('');

      setTimeout(() => {
        setShowReportModal(false);
        setReportSuccess(false);
      }, 2500);
    } catch (err) {
      console.error('Report submission failed:', err);
      alert('Error submitting report: ' + err.message);
    } finally {
      setReportLoading(false);
    }
  };

  const requestTenancyConfirmation = async (event) => {
    event.preventDefault();

    if (!user) {
      showToast('Sign in with your student account first.', 'info');
      router.push(`/auth?returnTo=/properties/${property.id}`);
      return;
    }

    if (!tenancyRoom.trim()) {
      showToast('Enter your room or unit number.', 'error');
      return;
    }

    setTenancyLoading(true);

    try {
      const { error } = await supabase.rpc('request_tenancy_connection', {
        requested_property_id: property.id,
        requested_room_number: tenancyRoom.trim(),
        requested_message: tenancyMessage.trim() || null
      });

      if (error) {
        throw error;
      }

      setTenancyStatus('pending');
      setShowTenancyModal(false);
      showToast('Your tenancy confirmation request was sent to the landlord.', 'success');
    } catch (error) {
      console.error('Tenancy request failed:', error);
      showToast(error.message || 'Unable to send the tenancy request.', 'error');
    } finally {
      setTenancyLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-gray-400">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
        Loading property details...
      </div>
    );
  }

  if (!property) {
    return <div className="p-16 text-center text-gray-400">Property not found or has been removed.</div>;
  }

  const rentAmount = property.semester_rent || 0;
  const latestRentNotice = rentNotices[0] || null;
  const noticeDifference = latestRentNotice
    ? Number(
        latestRentNotice.proposed_semester_rent
      ) -
      Number(
        latestRentNotice.previous_semester_rent
      )
    : 0;
  const noticePercentage =
    latestRentNotice &&
    Number(
      latestRentNotice.previous_semester_rent
    ) > 0
      ? (
          noticeDifference /
          Number(
            latestRentNotice.previous_semester_rent
          )
        ) * 100
      : 0;
  const fixedCharges = Number(property.deposit_amount || 0) + Number(property.electricity_cost || 0) + Number(property.wifi_cost || 0);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 text-white space-y-6">
      <div className="relative">
        <ImageCarousel images={property.images || []} />
        <button
          onClick={handleBookmarkToggle}
          className={`absolute top-4 right-4 z-10 px-4 py-2 rounded-xl backdrop-blur-md flex items-center gap-2 font-medium transition shadow-lg ${
            isBookmarked ? 'bg-amber-500 text-white' : 'bg-black/60 text-white hover:bg-black/80 border border-white/10'
          }`}
        >
          <Bookmark size={18} fill={isBookmarked ? 'white' : 'none'} />
          {isBookmarked ? 'Saved' : 'Save Property'}
        </button>
      </div>
      
      <div className="bg-[#18181B] border border-white/10 rounded-2xl shadow-xl p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
            <div className="mb-1">
              <h1 className="text-2xl md:text-3xl font-bold">{property.title}</h1>
              <div className="flex items-center gap-2 mt-2">
              {property.is_flagged ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-300">
                  <Flag size={12} />
                  Flagged for Review
                </span>
              ) : property.verification_status === 'verified' || property.is_verified === true ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                  <CheckCircle size={12} />
                  Chuka Rentals Verified
                </span>
              ) : null}
            </div>
            </div>
            <p className="text-gray-400 text-sm">
              {property.house_type || 'Bedsitter'} • 📍 {property.landmark || property.campus_landmark || 'Ndagani'}
            </p>

            {property.is_flagged && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-4 py-4 rounded-xl mt-3">
                <div className="flex items-center gap-2 font-semibold">
                  <Flag size={17} />
                  Listing flagged for administrator review
                </div>

                {property.flag_reason && (
                  <p className="text-sm text-red-200/80 mt-2">
                    Reported issue: {property.flag_reason}
                  </p>
                )}

                <p className="text-xs text-red-200/60 mt-2">
                  This report has not yet been confirmed by Chuka Rentals.
                </p>
              </div>
            )}
          </div>
          
          <div className="text-right flex flex-col items-start md:items-end gap-2">
            <div>
              <span className="text-2xl md:text-3xl font-extrabold text-emerald-400">
                Ksh {Number(rentAmount).toLocaleString()}
              </span>
              <p className="text-xs text-gray-400">Semester Rent</p>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-xs text-gray-400 bg-[#242427] px-2.5 py-1 rounded-lg">
                <Eye size={14} /> {property.views_count || 0} views
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${property.vacant_rooms > 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                {property.vacant_rooms > 0 ? `${property.vacant_rooms} Rooms Vacant` : 'Fully Booked'}
              </span>
            </div>
          </div>
        </div>

        {latestRentNotice && (
          <section className="overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/10">
            <div className="flex flex-col gap-5 p-5 md:flex-row md:items-start md:justify-between">
              <div className="flex gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
                  <BellRing size={22} />
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Published semester rent notice
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-white">
                    The semester rent will change
                  </h2>

                  <p className="mt-2 text-sm text-gray-300">
                    This notice was published on{' '}
                    {new Date(
                      latestRentNotice.notice_date
                    ).toLocaleDateString('en-KE')}.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 px-5 py-4 text-left md:text-right">
                <p className="text-sm text-gray-400">
                  Previous semester rent
                </p>

                <p className="font-semibold text-gray-200">
                  KSh{' '}
                  {Number(
                    latestRentNotice.previous_semester_rent
                  ).toLocaleString()}
                </p>

                <div className="my-2 flex items-center gap-2 md:justify-end">
                  <TrendingUp
                    size={17}
                    className={
                      noticeDifference > 0
                        ? 'text-amber-400'
                        : 'rotate-180 text-emerald-400'
                    }
                  />

                  <span
                    className={
                      noticeDifference > 0
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }
                  >
                    {noticePercentage > 0 ? '+' : ''}
                    {noticePercentage.toFixed(1)}%
                  </span>
                </div>

                <p className="text-sm text-gray-400">
                  Proposed semester rent
                </p>

                <p className="text-xl font-bold text-white">
                  KSh{' '}
                  {Number(
                    latestRentNotice.proposed_semester_rent
                  ).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="border-t border-amber-500/20 bg-black/10 p-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500">
                    Effective semester
                  </p>

                  <p className="mt-1 font-semibold text-white">
                    {latestRentNotice.effective_semester}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500">
                    Landlord&apos;s justification
                  </p>

                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-300">
                    {latestRentNotice.reason}
                  </p>
                </div>
              </div>

              {latestRentNotice.supporting_document_url && (
                <a
                  href={
                    latestRentNotice.supporting_document_url
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-block text-sm font-semibold text-blue-400 hover:text-blue-300"
                >
                  View supporting document
                </a>
              )}

              <p className="mt-4 text-xs text-gray-500">
                This is a published pricing notice. Student
                acknowledgement confirms receipt only and does not
                represent agreement with the change.
              </p>
            </div>
          </section>
        )}

        <div className="flex flex-col sm:flex-row gap-4 pt-2">
          <button 
            onClick={handleWhatsApp} 
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-600/20"
          >
            💬 WhatsApp Landlord
          </button>
          <button 
            onClick={handleCall} 
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-blue-600/20"
          >
            📞 Call Landlord
          </button>
          <button
            type="button"
            onClick={() => setShowViewingRequest(true)}
            className="flex-1 bg-[#242427] hover:bg-[#303036] text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 border border-white/10 transition"
          >
            <CalendarDays size={18} />
            Request Viewing
          </button>
        </div>

        <section className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                <House size={21} />
              </div>

              <div>
                <h3 className="font-semibold">
                  Do you currently live here?
                </h3>

                <p className="mt-1 text-sm text-gray-400">
                  Connect your student account to this property to receive rent notices and important housing updates.
                </p>

                {tenancyStatus && (
                  <p
                    className={`mt-2 text-sm font-semibold ${
                      tenancyStatus === 'confirmed'
                        ? 'text-emerald-400'
                        : tenancyStatus === 'pending'
                          ? 'text-amber-400'
                          : 'text-red-400'
                    }`}
                  >
                    {tenancyStatus === 'confirmed' &&
                      'Confirmed tenant \u2713'}

                    {tenancyStatus === 'pending' &&
                      'Waiting for landlord confirmation'}

                    {tenancyStatus === 'rejected' &&
                      'The previous request was not confirmed'}

                    {tenancyStatus === 'ended' &&
                      'Previous tenancy ended'}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              disabled={
                tenancyStatus === 'pending' ||
                tenancyStatus === 'confirmed'
              }
              onClick={() => {
                if (!user) {
                  router.push(
                    `/auth?returnTo=/properties/${property.id}`
                  );
                  return;
                }

                setShowTenancyModal(true);
              }}
              className="shrink-0 rounded-xl border border-blue-500/30 bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {tenancyStatus === 'confirmed'
                ? 'Tenancy confirmed'
                : tenancyStatus === 'pending'
                  ? 'Confirmation pending'
                  : tenancyStatus === 'rejected'
                    ? 'Request again'
                    : tenancyStatus === 'ended'
                      ? 'Reconnect tenancy'
                      : 'I currently live here'}
            </button>
          </div>
        </section>

        {/* Property Specifications */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-[#E8DCC4] mb-4">Property Specifications</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* Walking Time */}
            <div className="bg-[#121215] border border-white/10 rounded-2xl p-5 flex flex-col justify-between">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Walking Time</span>
              <span className="text-lg font-semibold text-white mt-2">{property.walk_mins} Mins to Campus</span>
            </div>

            {/* Electricity */}
            <div className="bg-[#121215] border border-white/10 rounded-2xl p-5 flex flex-col justify-between">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Electricity Type</span>
              <span className="text-lg font-semibold text-white mt-2">{property.electricity_type || 'Prepaid Tokens'}</span>
            </div>

            {/* Water Supply & Cost */}
            <div className="bg-[#121215] border border-white/10 rounded-2xl p-5 flex flex-col justify-between">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Water Supply</span>
              <div className="mt-2">
                <span className="text-lg font-semibold text-white block">{property.water_type || 'Running Water'}</span>
                {property.water_cost && (
                  <span className="text-sm font-medium text-[#E8DCC4] bg-[#E8DCC4]/10 px-2.5 py-0.5 rounded-md inline-block mt-1">
                    {property.water_cost}
                  </span>
                )}
              </div>
            </div>

            {/* Security */}
            <div className="bg-[#121215] border border-white/10 rounded-2xl p-5 flex flex-col justify-between">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Security System</span>
              <span className="text-lg font-semibold text-white mt-2">{property.security_system || 'Security Guard'}</span>
            </div>

          </div>

          {/* Wi-Fi Badge if available */}
          {property.wifi_available && (
            <div className="mt-4 inline-flex items-center gap-2 bg-[#E8DCC4]/10 border border-[#E8DCC4]/20 px-4 py-2 rounded-xl text-[#E8DCC4] text-sm font-medium">
              <span>📶 High-Speed Wi-Fi Available On Premises</span>
            </div>
          )}
        </div>

        {property.latitude !== null &&
          property.latitude !== undefined &&
          property.longitude !== null &&
          property.longitude !== undefined && (
            <div className="border-t border-white/10 pt-6">
              <div className="mb-4">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <MapPin size={19} className="text-blue-400" />
                  Hostel location and directions
                </h3>
                <p className="mt-1 text-sm text-gray-400">
                  View the verified destination or open turn-by-turn directions.
                </p>
              </div>

              <PropertyMapViewer
                latitude={property.latitude}
                longitude={property.longitude}
              />
            </div>
          )}

        <div className="border-t border-white/10 pt-6">
          <h3 className="text-lg font-semibold mb-2">Description & Notes</h3>
          <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
            {property.description || 'No extra description provided by the landlord.'}
          </p>
        </div>

        <div className="border-t border-white/10 pt-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Semester Cost Breakdown</h3>
            <p className="mt-1 text-sm text-gray-400">Charges declared by the property manager for one semester.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[['Semester rent', rentAmount], ['Deposit', property.deposit_amount], ['Electricity', property.electricity_cost], ['Wi-Fi', property.wifi_cost]].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-[#121215] p-4"><span className="block text-xs text-gray-500">{label}</span><strong className="mt-1 block">KSh {Number(value || 0).toLocaleString()}</strong></div>
            ))}
          </div>
          <p className="text-sm text-emerald-300">Declared upfront total: KSh {(Number(rentAmount) + fixedCharges).toLocaleString()}</p>
          {property.other_charges && <p className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-100"><strong>Other terms:</strong> {property.other_charges}</p>}
        </div>

        <div className="border-t border-white/10 pt-6 space-y-4">
          <h3 className="flex items-center gap-2 text-lg font-semibold"><UserRound size={19} className="text-blue-400" /> Verified Property Management</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-[#121215] p-5"><span className="text-xs uppercase tracking-wide text-gray-500">Landlord / manager</span><p className="mt-2 font-semibold">{property.landlord_display_name || property.landlord?.full_name || 'Name pending verification'}</p><p className="mt-1 text-xs text-emerald-400">{property.landlord?.verification_status === 'verified' ? 'Identity verified ✓' : 'Listing contact'}</p></div>
            <div className="rounded-xl border border-white/10 bg-[#121215] p-5"><span className="text-xs uppercase tracking-wide text-gray-500">Trusted caretaker</span><p className="mt-2 font-semibold">{property.caretaker_name || 'No separate caretaker listed'}</p>{property.caretaker_hours && <p className="mt-1 text-sm text-gray-400">Available: {property.caretaker_hours}</p>}{property.caretaker_phone && <a className="mt-2 inline-block text-sm text-blue-400" href={`tel:${property.caretaker_phone}`}>Call caretaker</a>}</div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs"><span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1.5"><ShieldCheck size={14} /> {property.security_lighting ? 'Security lighting' : 'Security lighting not declared'}</span><span className="rounded-full bg-white/5 px-3 py-1.5">{property.cctv_available ? 'CCTV available' : 'CCTV not declared'}</span></div>
        </div>

        <div className="border-t border-white/10 pt-4 flex justify-between items-center text-xs text-gray-400">
          <span>Listed by Verified Landlord</span>
          <button
            onClick={() => setShowReportModal(true)}
            className="text-red-400 hover:text-red-300 flex items-center gap-1 transition"
          >
            <Flag size={14} /> Report issue with this listing
          </button>
        </div>
      </div>

      {rentNotices.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-[#18181B] p-6">
          <div>
            <p className="text-sm font-semibold text-blue-400">
              Pricing transparency
            </p>

            <h2 className="mt-1 text-xl font-bold">
              Semester rent history
            </h2>

            <p className="mt-1 text-sm text-gray-400">
              Published rent-change notices for this property.
            </p>
          </div>

          <div className="mt-5 space-y-3">
            {rentNotices.map((notice) => {
              const difference =
                Number(
                  notice.proposed_semester_rent
                ) -
                Number(
                  notice.previous_semester_rent
                );

              const percentage =
                Number(
                  notice.previous_semester_rent
                ) > 0
                  ? (
                      difference /
                      Number(
                        notice.previous_semester_rent
                      )
                    ) * 100
                  : 0;

              return (
                <article
                  key={notice.id}
                  className="rounded-xl border border-white/10 bg-[#101013] p-4"
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row">
                    <div>
                      <p className="font-semibold">
                        {notice.effective_semester}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        Notice published{' '}
                        {new Date(
                          notice.notice_date
                        ).toLocaleDateString('en-KE')}
                      </p>
                    </div>

                    <div className="sm:text-right">
                      <p className="font-semibold">
                        KSh{' '}
                        {Number(
                          notice.previous_semester_rent
                        ).toLocaleString()}
                        {' -> '}
                        KSh{' '}
                        {Number(
                          notice.proposed_semester_rent
                        ).toLocaleString()}
                      </p>

                      <p
                        className={`mt-1 text-sm ${
                          percentage > 0
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {percentage > 0 ? '+' : ''}
                        {percentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 border-t border-white/10 pt-3 text-sm text-gray-300">
                    {notice.reason}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Professional Student Review Section */}
      <ReviewSection
        propertyId={property.id}
        propertyOwnerId={property.user_id || property.landlord_id}
      />
      <div className="fixed inset-x-0 bottom-14 z-30 grid grid-cols-3 gap-2 border-t border-white/10 bg-[#121215]/95 p-3 backdrop-blur-xl md:hidden"><button onClick={handleBookmarkToggle} className="rounded-xl border border-white/10 py-3 text-xs">{isBookmarked ? 'Saved' : 'Save'}</button><button onClick={handleWhatsApp} className="rounded-xl bg-emerald-600 py-3 text-xs font-semibold">WhatsApp</button><button onClick={() => setShowViewingRequest(true)} className="rounded-xl bg-blue-600 py-3 text-xs font-semibold">View Room</button></div>
      {showViewingRequest && <ViewingRequestModal property={property} user={user} onClose={() => setShowViewingRequest(false)} />}

      {showTenancyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <form
            onSubmit={requestTenancyConfirmation}
            className="w-full max-w-md space-y-5 rounded-2xl border border-white/10 bg-[#18181B] p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-blue-400">
                  Tenant confirmation
                </p>

                <h2 className="mt-1 text-xl font-bold">
                  Confirm that you live here
                </h2>

                <p className="mt-1 text-sm text-gray-400">
                  The landlord will review your request before you receive tenant-only notices.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowTenancyModal(false)}
                className="text-xl text-gray-400 hover:text-white"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Property
              </label>

              <div className="rounded-xl border border-white/10 bg-[#101013] p-3 text-sm text-gray-300">
                {property.title}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Room or unit number *
              </label>

              <input
                type="text"
                required
                maxLength={50}
                value={tenancyRoom}
                onChange={(event) =>
                  setTenancyRoom(event.target.value)
                }
                placeholder="For example, Room 12"
                className="w-full rounded-xl border border-white/10 bg-[#101013] p-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Message to landlord
              </label>

              <textarea
                rows={3}
                maxLength={500}
                value={tenancyMessage}
                onChange={(event) =>
                  setTenancyMessage(event.target.value)
                }
                placeholder="Optional information that can help the landlord identify your tenancy."
                className="w-full rounded-xl border border-white/10 bg-[#101013] p-3 outline-none focus:border-blue-500"
              />

              <p className="mt-1 text-right text-xs text-gray-500">
                {tenancyMessage.length}/500
              </p>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
              Only request confirmation for a property where you currently live. Your account identity and room number will be shared with the landlord for verification.
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowTenancyModal(false)}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-3 font-semibold hover:bg-white/10"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={tenancyLoading}
                className="flex-1 rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
              >
                {tenancyLoading
                  ? 'Sending...'
                  : 'Send request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-white/10 rounded-2xl p-6 md:p-8 max-w-md w-full space-y-4">
            <h2 className="text-xl font-bold text-white">Report Listing</h2>
            <p className="text-sm text-gray-400">
              Help us maintain accurate housing records around Chuka University.
            </p>
            {reportSuccess ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-sm">
                ✅ Report submitted successfully. Our team will review it immediately.
              </div>
            ) : (
              <form onSubmit={handleReport} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Issue Type</label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full bg-[#18181B] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    <option value="Fraudulent Listing">Fraudulent Listing</option>
                    <option value="Already Occupied">Already Occupied / Fully Booked</option>
                    <option value="Incorrect Pricing">Incorrect Pricing Information</option>
                    <option value="Wrong or Misleading Photos">Wrong or Misleading Photos</option>
                    <option value="Incorrect Landlord/Caretaker Information">
                      Incorrect Landlord/Caretaker Information
                    </option>
                    <option value="Suspicious Activity">Suspicious Activity</option>
                    <option value="Duplicate Listing">Duplicate Listing</option>
                    <option value="Other">Other Grievance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
                  <textarea
                    className="w-full bg-[#18181B] border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none"
                    rows="3"
                    required
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder="Provide specific details..."
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reportLoading}
                    className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl text-sm transition disabled:opacity-50"
                  >
                    {reportLoading ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
