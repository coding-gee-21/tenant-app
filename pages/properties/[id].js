import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useUser } from '../../lib/useUser';
import ImageCarousel from '../../components/ImageCarousel';
import { handleWhatsAppClick } from '../../utils/trackLead';
import { Eye, Bookmark, Flag, Star } from 'lucide-react';
import ReviewCard from '../../components/ReviewCard';

export default function PropertyDetail() {
  const router = useRouter();
  const { id } = router.query;
  const user = useUser();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Bookmarks & Views
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Reporting Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState('Fraudulent Listing');
  const [reportReason, setReportReason] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  // Reviews States
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const [reviewImage, setReviewImage] = useState(null);
  const [reviewImagePreview, setReviewImagePreview] = useState(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');

  useEffect(() => {
    if (!id || id === '[id]') return;
    async function loadPropertyAndRecordView() {
      // 1. Fetch Property Details
      const { data, error } = await supabase
        .from('properties')
        .select('*, landlord:landlords(*)')
        .eq('id', id)
        .single();
      
      if (!error && data) {
        setProperty(data);
        fetchReviews(id);

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

  const fetchReviews = async (propId) => {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*, profiles(full_name)')
        .eq('property_id', propId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (err) {
      console.error('Error fetching reviews:', err.message);
    }
  };

  const handleBookmarkToggle = async () => {
    if (!user) {
      alert('Please log in to save properties to your bookmarks.');
      router.push('/auth');
      return;
    }

    if (isBookmarked) {
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('user_id', user.id)
        .eq('property_id', id);
      if (!error) setIsBookmarked(false);
    } else {
      const { error } = await supabase
        .from('bookmarks')
        .insert({ user_id: user.id, property_id: id });
      if (!error) setIsBookmarked(true);
    }
  };

  const handleWhatsApp = async () => {
    if (!property) return;
    const phone = property.whatsapp || property.landlord?.whatsapp_number || '254708797271';
    const msg = `Hi, I saw your listing "${property.title}" on Tenant. Is it still available?`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    
    handleWhatsAppClick(property.id, phone);
    window.open(url, '_blank');
    
    try {
      if (property.user_id) {
        await supabase.from('notifications').insert({
          landlord_id: property.user_id,
          title: 'New WhatsApp Lead',
          message: `A student clicked WhatsApp for your property "${property.title}".`,
          type: 'whatsapp_lead'
        });
      }

      await supabase.from('property_inquiries').insert({
        property_id: property.id,
        inquiry_type: 'whatsapp'
      });
    } catch (err) {
      console.error('Failed to track inquiry:', err);
    }
  };

  const handleCall = async () => {
    if (!property) return;
    const phone = property.whatsapp || property.landlord?.phone_number || '254708797271';
    window.location.href = `tel:${phone}`;
    try {
      await supabase.from('property_inquiries').insert({
        property_id: property.id,
        inquiry_type: 'call'
      });
    } catch (err) {
      console.error('Failed to track call inquiry:', err);
    }
  };

  const handleReport = async (e) => {
    e.preventDefault();
    if (!reportReason.trim()) {
      alert('Please describe the issue.');
      return;
    }

    setReportLoading(true);
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('property_reports')
      .insert({
        property_id: property.id,
        reporter_id: currentUser ? currentUser.id : null,
        issue_type: reportType,
        description: reportReason,
      });

    // Notify Landlord regarding report
    if (property.user_id) {
      await supabase.from('notifications').insert({
        landlord_id: property.user_id,
        title: 'Listing Flagged / Reported',
        message: `Your property "${property.title}" has been reported for: ${reportType}.`,
        type: 'property_report'
      });
    }

    setReportLoading(false);
    if (error) {
      alert('Error submitting report: ' + error.message);
    } else {
      setReportSuccess(true);
      setReportReason('');
      setTimeout(() => {
        setShowReportModal(false);
        setReportSuccess(false);
      }, 2500);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setSubmittingReview(true);
    setReviewError('');

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        alert('Your session is invalid or expired. Please log in again.');
        router.push('/auth');
        return;
      }

      const userId = user.id;

      let imageUrl = null;
      if (reviewImage) {
        const fileExt = reviewImage.name.split('.').pop();
        const fileName = `${userId}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('review-images')
          .upload(filePath, reviewImage);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('review-images')
          .getPublicUrl(filePath);

        imageUrl = publicUrlData.publicUrl;
      }

      const { error: insertError } = await supabase.from('reviews').insert({
        property_id: id,
        user_id: userId,
        rating: parseInt(rating),
        comment,
        image_url: imageUrl
      });

      if (insertError) throw insertError;

      setComment('');
      setReviewImage(null);
      setReviewImagePreview(null);
      
      fetchReviews(id); 
    } catch (err) {
      console.error(err);
      setReviewError(err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleReviewImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setReviewImage(file);
      setReviewImagePreview(URL.createObjectURL(file));
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

  const rentAmount = property.semester_rent || property.price || property.rent || 0;

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
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl md:text-3xl font-bold">{property.title}</h1>
              {property.is_verified && (
                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs px-2.5 py-1 rounded-full font-semibold">
                  Verified Landlord ✅
                </span>
              )}
            </div>
            <p className="text-gray-400 text-sm">
              {property.house_type || 'Bedsitter'} • 📍 {property.landmark || property.campus_landmark || 'Ndagani'}
            </p>

            {property.is_flagged && (
              <div className="bg-red-900/80 border border-red-700 text-red-200 px-4 py-3 rounded-md mt-3 flex items-center justify-between">
                <span className="font-semibold">⚠️ Warning: This listing has been flagged as unverified or suspicious by the community.</span>
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

        <div className="flex flex-col sm:flex-row gap-4 pt-2">
          <button 
            onClick={handleWhatsApp} 
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-600/20"
          >
            💬 WhatsApp Caretaker
          </button>
          <button 
            onClick={handleCall} 
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-blue-600/20"
          >
            📞 Call Caretaker
          </button>
        </div>

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

        <div className="border-t border-white/10 pt-6">
          <h3 className="text-lg font-semibold mb-2">Description & Notes</h3>
          <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
            {property.description || 'No extra description provided by the landlord.'}
          </p>
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

      {/* Student Reviews Section */}
      <div className="bg-[#18181B] border border-white/10 rounded-2xl p-6 md:p-8 space-y-6">
        <h3 className="text-xl font-bold">Student Reviews ({reviews.length})</h3>

        {reviewError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm">
            {reviewError}
          </div>
        )}

        <form onSubmit={handleReviewSubmit} className="bg-[#242427]/60 p-5 rounded-xl border border-white/5 space-y-4">
          <h4 className="text-sm font-semibold text-gray-200">Leave Your Review</h4>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Rating</label>
            <select
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              className="w-full bg-[#121215] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="5">⭐⭐⭐⭐⭐ (5/5)</option>
              <option value="4">⭐⭐⭐⭐ (4/5)</option>
              <option value="3">⭐⭐⭐ (3/5)</option>
              <option value="2">⭐⭐ (2/5)</option>
              <option value="1">⭐ (1/5)</option>
            </select>
          </div>
          <div>
            <textarea
              rows="3"
              required
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your experience regarding water, security, or landlord responsiveness..."
              className="w-full bg-[#121215] border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
            ></textarea>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Attach Photo (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleReviewImageChange}
              className="w-full bg-[#121215] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
            {reviewImagePreview && (
              <img src={reviewImagePreview} alt="Preview" className="mt-2 w-32 h-32 object-cover rounded-md border border-white/10" />
            )}
          </div>
          <button
            type="submit"
            disabled={submittingReview}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            {submittingReview ? 'Submitting...' : 'Post Review'}
          </button>
        </form>

        <div className="space-y-3">
          {reviews.length === 0 ? (
            <p className="text-sm text-gray-400">No reviews yet. Be the first student to review this hostel!</p>
          ) : (
            reviews.map((rev) => <ReviewCard key={rev.id} review={rev} />)
          )}
        </div>
      </div>

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